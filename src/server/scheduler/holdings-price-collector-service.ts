// PRD-FEAT-017: Holdings Price Collection Scheduler
import type { Product, TaskExecution } from '../../shared/types.js'
import type { ProductRepository } from '../database/product-repository.js'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { NaverFinanceAdapter } from './naver-finance-adapter.js'
import type { YahooFinanceAdapter } from './yahoo-finance-adapter.js'
import { resolveAdapter } from './exchange-routing.js'
import { withRetry } from './with-retry.js'
import { log } from '../middleware/logger.js'

type Scope = 'domestic' | 'foreign' | 'all'

function formatToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    private readonly naverAdapter: NaverFinanceAdapter,
    private readonly yahooAdapter: YahooFinanceAdapter,
    private readonly domesticTaskId: number,
    private readonly foreignTaskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  async run(scope: Scope = 'all'): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Holdings price collection is already running')
    }
    this.isRunning = true
    try {
      return await this.executeCollection(scope)
    } finally {
      this.isRunning = false
    }
  }

  private resolveTaskId(scope: Scope): number {
    return scope === 'foreign' ? this.foreignTaskId : this.domesticTaskId
  }

  private async executeCollection(scope: Scope): Promise<TaskExecution> {
    const taskId = this.resolveTaskId(scope)
    const execution = await this.taskExecutionRepo.create({
      taskId,
      startedAt: new Date(),
    })

    const allHeld = await this.productRepo.findWithActiveHoldings()
    const products = this.filterByScope(allHeld, scope)
    const today = formatToday()

    let succeeded = 0
    let failed = 0
    let skipped = 0

    for (const product of products) {
      const result = await this.collectProduct(product, today)
      if (result === 'success') succeeded++
      else if (result === 'failed') failed++
      else skipped++
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
    today: string,
  ): Promise<'success' | 'failed' | 'skipped'> {
    if (!product.code) {
      log('warn', `Skipping product ${product.id} (${product.name}): no code`)
      return 'skipped'
    }

    const adapter = resolveAdapter(product.exchange)
    if (adapter === 'unknown') {
      log('warn', `Skipping product ${product.id} (${product.name}): unknown exchange '${product.exchange}'`)
      return 'skipped'
    }

    try {
      if (adapter === 'naver') {
        const compact = formatDateCompact(today)
        const rows = await withRetry(() =>
          this.naverAdapter.fetchPrices(product.code!, product.id, compact, compact),
        )
        if (rows.length > 0) {
          await this.priceHistoryRepo.upsertMany(rows)
        }
      } else {
        const todayDate = new Date(`${today}T00:00:00.000Z`)
        const rows = await withRetry(() =>
          this.yahooAdapter.fetchPrices(product.code!, product.id, todayDate, todayDate),
        )
        if (rows.length > 0) {
          await this.priceHistoryRepo.upsertMany(rows)
        }
      }

      log('info', `Holdings price collected: ${product.code} (${product.name})`)
      return 'success'
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `Holdings price failed for ${product.code}: ${msg}`)
      return 'failed'
    }
  }
}
