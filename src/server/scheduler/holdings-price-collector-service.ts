// PRD-FEAT-017: Holdings Price Collection Scheduler
import type { Product, TaskExecution } from '../../shared/types.js'
import type { ProductRepository } from '../database/product-repository.js'
import type { PriceHistoryRepository, PriceRow } from '../database/price-history-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { TaskExecutionDetailRepository } from '../database/task-execution-detail-repository.js'
import type { NaverFinanceAdapter } from './naver-finance-adapter.js'
import type { YahooFinanceAdapter } from './yahoo-finance-adapter.js'
import { resolveAdapter } from './exchange-routing.js'
import { withRetry } from './with-retry.js'
import { log } from '../middleware/logger.js'

type Scope = 'domestic' | 'foreign' | 'all'

const DEFAULT_LOOKBACK_DAYS = 3

export const PERIOD_LOOKBACK_MAP: Record<string, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
} as const

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateRange(lookbackDays: number): { readonly startDate: string; readonly endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - lookbackDays)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

function formatDateCompact(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

export class HoldingsPriceCollectorService {
  private isRunning = false

  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceHistoryRepo: PriceHistoryRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly detailRepo: TaskExecutionDetailRepository,
    private readonly naverAdapter: NaverFinanceAdapter,
    private readonly yahooAdapter: YahooFinanceAdapter,
    private readonly domesticTaskId: number,
    private readonly foreignTaskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  async run(scope: Scope = 'all', lookbackDays: number = DEFAULT_LOOKBACK_DAYS): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Holdings price collection is already running')
    }
    this.isRunning = true
    try {
      return await this.executeCollection(scope, lookbackDays)
    } finally {
      this.isRunning = false
    }
  }

  private resolveTaskId(scope: Scope): number {
    return scope === 'foreign' ? this.foreignTaskId : this.domesticTaskId
  }

  private async executeCollection(scope: Scope, lookbackDays: number): Promise<TaskExecution> {
    const taskId = this.resolveTaskId(scope)
    const execution = await this.taskExecutionRepo.create({
      taskId,
      startedAt: new Date(),
    })

    const allHeld = await this.productRepo.findWithActiveHoldings()
    const products = this.filterByScope(allHeld, scope)
    const { startDate, endDate } = getDateRange(lookbackDays)

    let succeeded = 0
    let failed = 0
    let skipped = 0

    for (const product of products) {
      const result = await this.collectProduct(product, startDate, endDate)
      if (result.status === 'success') succeeded++
      else if (result.status === 'failed') failed++
      else skipped++
      await this.detailRepo.create({
        executionId: execution.id,
        productId: product.id,
        status: result.status,
        message: result.message,
      })
    }

    const status = failed === 0 ? 'success' : succeeded === 0 ? 'failed' : 'partial'
    const completed = await this.taskExecutionRepo.complete(execution.id, {
      status,
      productsTotal: products.length,
      productsSucceeded: succeeded,
      productsFailed: failed,
      productsSkipped: skipped,
      message: null,
    })

    await this.taskExecutionRepo.trimOldExecutions(taskId)
    return completed!
  }

  private filterByScope(products: readonly Product[], scope: Scope): readonly Product[] {
    if (scope === 'all') return products
    return products.filter((p) => {
      const adapter = resolveAdapter(p.exchange)
      if (scope === 'domestic') return adapter === 'naver'
      if (scope === 'foreign') return adapter === 'yahoo'
      return false
    })
  }

  private async collectProduct(
    product: Product,
    startDate: string,
    endDate: string,
  ): Promise<{ readonly status: 'success' | 'failed' | 'skipped'; readonly message?: string | null }> {
    if (!product.code) {
      log('warn', `Skipping product ${product.id} (${product.name}): no code`)
      return { status: 'skipped', message: 'No product code' }
    }

    const adapter = resolveAdapter(product.exchange)
    if (adapter === 'unknown') {
      log('warn', `Skipping product ${product.id} (${product.name}): unknown exchange '${product.exchange}'`)
      return { status: 'skipped', message: `Unknown exchange: ${product.exchange}` }
    }

    try {
      let rows: readonly PriceRow[]
      if (adapter === 'naver') {
        const compactStart = formatDateCompact(startDate)
        const compactEnd = formatDateCompact(endDate)
        rows = await withRetry(() =>
          this.naverAdapter.fetchPrices(product.code!, product.id, compactStart, compactEnd),
        )
      } else {
        const start = new Date(`${startDate}T00:00:00.000Z`)
        const end = new Date(`${endDate}T00:00:00.000Z`)
        rows = await withRetry(() =>
          this.yahooAdapter.fetchPrices(product.code!, product.id, start, end),
        )
      }
      if (rows.length > 0) {
        await this.priceHistoryRepo.upsertMany(rows)
      }

      log('info', `Holdings price collected: ${product.code} (${product.name})`)
      return { status: 'success' }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `Holdings price failed for ${product.code}: ${msg}`)
      return { status: 'failed', message: msg }
    }
  }
}
