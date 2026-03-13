// PRD-FEAT-005: Price History Scheduler
// PRD-FEAT-009: Scheduler Execution Stop
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

type AdapterFetchFn = (product: Product, range: DateRange, signal?: AbortSignal) => Promise<readonly PriceRow[]>

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
  private abortController: AbortController | null = null

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

  abort(): void {
    this.abortController?.abort()
  }

  async run(fromDate?: string): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Collection is already running')
    }

    this.abortController = new AbortController()
    this.isRunning = true
    try {
      return await this.executeCollection(this.abortController.signal, fromDate)
    } finally {
      this.isRunning = false
      this.abortController = null
    }
  }

  private async executeCollection(signal: AbortSignal, fromDate?: string): Promise<TaskExecution> {
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

    const naverFetch: AdapterFetchFn = (p, r, s) => this.naverAdapter.fetchPrices(
      p.code!, p.id, formatDateYYYYMMDD(r.startDate), formatDateYYYYMMDD(r.endDate), s,
    )
    const yahooFetch: AdapterFetchFn = (p, r, s) => this.yahooAdapter.fetchPrices(
      p.code!, p.id, r.startDate, r.endDate, s,
    )

    const aborted =
      await this.processProducts(execution.id, naverProducts, naverFetch, NAVER_BATCH_SIZE, NAVER_DELAY_MS, counters, signal, fromDate) ||
      await this.processProducts(execution.id, yahooProducts, yahooFetch, YAHOO_BATCH_SIZE, YAHOO_DELAY_MS, counters, signal, fromDate)

    const status = aborted ? 'aborted' : this.determineStatus(counters)
    const message = aborted ? '사용자 요청으로 중지됨' : null
    const completed = await this.taskExecutionRepo.complete(execution.id, {
      status,
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
      message,
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

  /** Returns true if aborted */
  private async processProducts(
    executionId: number,
    products: readonly Product[],
    fetchFn: AdapterFetchFn,
    batchSize: number,
    delayMs: number,
    counters: CollectionCounters,
    signal: AbortSignal,
    fromDate?: string,
  ): Promise<boolean> {
    for (let i = 0; i < products.length; i += batchSize) {
      if (signal.aborted) return true

      const batch = products.slice(i, i + batchSize)
      const batchAborted = await this.processBatch(executionId, batch, fetchFn, counters, signal, fromDate)
      if (batchAborted) return true

      const isLastBatch = i + batchSize >= products.length
      if (!isLastBatch) {
        await sleep(delayMs)
      }
    }
    return false
  }

  /** Returns true if aborted */
  private async processBatch(
    executionId: number,
    batch: readonly Product[],
    fetchFn: AdapterFetchFn,
    counters: CollectionCounters,
    signal: AbortSignal,
    fromDate?: string,
  ): Promise<boolean> {
    for (const product of batch) {
      if (signal.aborted) return true
      try {
        await this.processOneProduct(product, fetchFn, counters, signal, fromDate)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return true
        }
        throw error
      }
      await this.updateExecutionProgress(executionId, counters)
    }
    return false
  }

  private async processOneProduct(
    product: Product,
    fetchFn: AdapterFetchFn,
    counters: CollectionCounters,
    signal?: AbortSignal,
    fromDate?: string,
  ): Promise<void> {
    const dateRange = await this.calculateDateRange(product.id, fromDate)

    if (dateRange === null) {
      counters.skipped++
      return
    }

    try {
      const rows = await withRetry(
        () => fetchFn(product, dateRange, signal),
        { signal },
      )
      await this.priceHistoryRepo.upsertMany(rows)
      counters.succeeded++
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      counters.failed++
      const message = error instanceof Error ? error.message : String(error)
      log('error', `Failed to fetch prices for ${product.name} (id=${product.id}): ${message}`)
    }
  }

  private async calculateDateRange(productId: number, fromDate?: string): Promise<DateRange | null> {
    const endDate = startOfDay(new Date())

    let startDate: Date
    if (fromDate) {
      startDate = new Date(`${fromDate}T00:00:00.000Z`)
    } else {
      const lastDate = await this.priceHistoryRepo.findLastDate(productId)
      startDate = lastDate !== undefined
        ? addDays(lastDate, 1)
        : new Date(endDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    }

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
