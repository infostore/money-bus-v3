// PRD-FEAT-005: Price History Scheduler
import type { Product, TaskExecution } from '../../shared/types.js'
import type { ProductRepository } from '../database/product-repository.js'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { NaverFinanceAdapter } from './naver-finance-adapter.js'
import type { YahooFinanceAdapter } from './yahoo-finance-adapter.js'
import type { PriceRow } from '../database/price-history-repository.js'
import { resolveAdapter } from './exchange-routing.js'
import { withRetry } from './with-retry.js'
import { log } from '../middleware/logger.js'

const LOOKBACK_DAYS = parseInt(process.env['PRICE_HISTORY_DEFAULT_LOOKBACK_DAYS'] ?? '365', 10)
const NAVER_BATCH_SIZE = 20
const NAVER_DELAY_MS = 1000
const YAHOO_BATCH_SIZE = 10
const YAHOO_DELAY_MS = 2000

interface DateRange {
  readonly startDate: Date
  readonly endDate: Date
}

interface CollectionCounters {
  total: number
  succeeded: number
  failed: number
  skipped: number
}

type AdapterFetchFn = (product: Product, range: DateRange) => Promise<readonly PriceRow[]>

export function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function addDays(dateStr: string, days: number): Date {
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class PriceCollectorService {
  private isRunning = false

  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceHistoryRepo: PriceHistoryRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly naverAdapter: NaverFinanceAdapter,
    private readonly yahooAdapter: YahooFinanceAdapter,
    private readonly taskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  async run(): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Collection is already running')
    }

    this.isRunning = true
    try {
      return await this.executeCollection()
    } finally {
      this.isRunning = false
    }
  }

  private async executeCollection(): Promise<TaskExecution> {
    const execution = await this.taskExecutionRepo.create({
      taskId: this.taskId,
      startedAt: new Date(),
    })

    const products = await this.productRepo.findAll()
    const counters: CollectionCounters = { total: 0, succeeded: 0, failed: 0, skipped: 0 }
    const { naverProducts, yahooProducts } = this.groupProducts(products, counters)

    // Set total count so UI shows progress immediately
    counters.total = naverProducts.length + yahooProducts.length
    await this.updateExecutionProgress(execution.id, counters)

    const naverFetch: AdapterFetchFn = (p, r) => this.naverAdapter.fetchPrices(
      p.code!, p.id, formatDateYYYYMMDD(r.startDate), formatDateYYYYMMDD(r.endDate),
    )
    const yahooFetch: AdapterFetchFn = (p, r) => this.yahooAdapter.fetchPrices(
      p.code!, p.id, r.startDate, r.endDate,
    )

    await this.processProducts(execution.id, naverProducts, naverFetch, NAVER_BATCH_SIZE, NAVER_DELAY_MS, counters)
    await this.processProducts(execution.id, yahooProducts, yahooFetch, YAHOO_BATCH_SIZE, YAHOO_DELAY_MS, counters)

    const status = this.determineStatus(counters)
    const completed = await this.taskExecutionRepo.complete(execution.id, {
      status,
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
      message: null,
    })

    await this.taskExecutionRepo.trimOldExecutions(this.taskId)

    return completed!
  }

  private groupProducts(
    products: readonly Product[],
    counters: CollectionCounters,
  ): { readonly naverProducts: readonly Product[]; readonly yahooProducts: readonly Product[] } {
    const naverProducts: Product[] = []
    const yahooProducts: Product[] = []

    for (const product of products) {
      if (product.code === null) {
        counters.skipped++
        continue
      }

      const adapterType = resolveAdapter(product.exchange)
      if (adapterType === 'unknown') {
        counters.skipped++
        log('warn', `Unknown exchange for product ${product.name} (id=${product.id}): ${product.exchange}`)
        continue
      }

      if (adapterType === 'naver') {
        naverProducts.push(product)
      } else {
        yahooProducts.push(product)
      }
    }

    return { naverProducts, yahooProducts }
  }

  private async processProducts(
    executionId: number,
    products: readonly Product[],
    fetchFn: AdapterFetchFn,
    batchSize: number,
    delayMs: number,
    counters: CollectionCounters,
  ): Promise<void> {
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)
      await this.processBatch(executionId, batch, fetchFn, counters)

      const isLastBatch = i + batchSize >= products.length
      if (!isLastBatch) {
        await sleep(delayMs)
      }
    }
  }

  private async processBatch(
    executionId: number,
    batch: readonly Product[],
    fetchFn: AdapterFetchFn,
    counters: CollectionCounters,
  ): Promise<void> {
    for (const product of batch) {
      await this.processOneProduct(product, fetchFn, counters)
      await this.updateExecutionProgress(executionId, counters)
    }
  }

  private async processOneProduct(
    product: Product,
    fetchFn: AdapterFetchFn,
    counters: CollectionCounters,
  ): Promise<void> {
    const dateRange = await this.calculateDateRange(product.id)

    if (dateRange === null) {
      counters.skipped++
      return
    }

    try {
      const rows = await withRetry(() => fetchFn(product, dateRange))
      await this.priceHistoryRepo.upsertMany(rows)
      counters.succeeded++
    } catch (error) {
      counters.failed++
      const message = error instanceof Error ? error.message : String(error)
      log('error', `Failed to fetch prices for ${product.name} (id=${product.id}): ${message}`)
    }
  }

  private async calculateDateRange(productId: number): Promise<DateRange | null> {
    const lastDate = await this.priceHistoryRepo.findLastDate(productId)
    const endDate = startOfDay(new Date())

    const startDate = lastDate !== undefined
      ? addDays(lastDate, 1)
      : new Date(endDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    if (startDate > endDate) {
      return null
    }

    return { startDate, endDate }
  }

  private async updateExecutionProgress(
    executionId: number,
    counters: CollectionCounters,
  ): Promise<void> {
    await this.taskExecutionRepo.updateProgress(executionId, {
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
    })
  }

  private determineStatus(
    counters: CollectionCounters,
  ): 'success' | 'partial' | 'failed' {
    if (counters.failed === 0) return 'success'
    if (counters.succeeded === 0) return 'failed'
    return 'partial'
  }
}
