// PRD-FEAT-005: Price History Scheduler
// PRD-FEAT-009: Scheduler Execution Stop
import type { Product, TaskExecution } from '../../shared/types.js'
import type { ProductRepository } from '../database/product-repository.js'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { TaskExecutionDetailRepository } from '../database/task-execution-detail-repository.js'
import type { CreateDetailInput } from '../../shared/types.js'
import type { NaverFinanceAdapter } from './naver-finance-adapter.js'
import type { YahooFinanceAdapter } from './yahoo-finance-adapter.js'
import type { PriceRow } from '../database/price-history-repository.js'
import { resolveAdapter } from './exchange-routing.js'
import { withRetry } from './with-retry.js'
import { sleep } from './sleep.js'
import { log } from '../middleware/logger.js'

const LOOKBACK_DAYS = parseInt(process.env['PRICE_HISTORY_DEFAULT_LOOKBACK_DAYS'] ?? '380', 10)
const NAVER_BATCH_SIZE = 10
const NAVER_BATCH_DELAY_MS = 3000
const NAVER_REQUEST_DELAY_MS = 500
const YAHOO_BATCH_SIZE = 5
const YAHOO_BATCH_DELAY_MS = 5000
const YAHOO_REQUEST_DELAY_MS = 1000

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

export class PriceCollectorService {
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceHistoryRepo: PriceHistoryRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly detailRepo: TaskExecutionDetailRepository,
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
    const { naverProducts, yahooProducts, skippedDetails } = this.groupProducts(products, counters, execution.id)

    // Write skipped detail rows upfront
    if (skippedDetails.length > 0) {
      await this.detailRepo.createMany(skippedDetails)
    }

    // Set total count so UI shows progress immediately
    counters.total = naverProducts.length + yahooProducts.length
    await this.updateExecutionProgress(execution.id, counters)

    const naverFetch: AdapterFetchFn = (p, r, s) => this.naverAdapter.fetchPrices(
      p.code!, p.id, formatDateYYYYMMDD(r.startDate), formatDateYYYYMMDD(r.endDate), s,
    )
    const yahooFetch: AdapterFetchFn = (p, r, s) => this.yahooAdapter.fetchPrices(
      p.code!, p.id, r.startDate, r.endDate, s,
    )

    let aborted = false
    let unexpectedError: string | null = null
    try {
      aborted =
        await this.processProducts(execution.id, naverProducts, naverFetch, NAVER_BATCH_SIZE, NAVER_BATCH_DELAY_MS, NAVER_REQUEST_DELAY_MS, counters, signal, fromDate) ||
        await this.processProducts(execution.id, yahooProducts, yahooFetch, YAHOO_BATCH_SIZE, YAHOO_BATCH_DELAY_MS, YAHOO_REQUEST_DELAY_MS, counters, signal, fromDate)
    } catch (error) {
      unexpectedError = error instanceof Error ? error.message : String(error)
      log('error', `Price collection crashed: ${unexpectedError}`)
    }

    const status = aborted ? 'aborted' : unexpectedError ? 'failed' : this.determineStatus(counters)
    const message = aborted
      ? '사용자 요청으로 중지됨'
      : unexpectedError
        ? `수집 중 오류 발생: ${unexpectedError}`
        : null
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
    executionId: number,
  ): { readonly naverProducts: readonly Product[]; readonly yahooProducts: readonly Product[]; readonly skippedDetails: readonly CreateDetailInput[] } {
    const skippedDetails: CreateDetailInput[] = []
    const naverProducts: Product[] = []
    const yahooProducts: Product[] = []

    for (const product of products) {
      if (product.code === null) {
        counters.skipped++
        skippedDetails.push({ executionId, productId: product.id, status: 'skipped', message: 'No product code' })
        continue
      }

      const adapterType = resolveAdapter(product.exchange)
      if (adapterType === 'unknown') {
        counters.skipped++
        skippedDetails.push({ executionId, productId: product.id, status: 'skipped', message: `Unknown exchange: ${product.exchange}` })
        log('warn', `Unknown exchange for product ${product.name} (id=${product.id}): ${product.exchange}`)
        continue
      }

      if (adapterType === 'naver') {
        naverProducts.push(product)
      } else {
        yahooProducts.push(product)
      }
    }

    return { naverProducts, yahooProducts, skippedDetails }
  }

  /** Returns true if aborted */
  private async processProducts(
    executionId: number,
    products: readonly Product[],
    fetchFn: AdapterFetchFn,
    batchSize: number,
    batchDelayMs: number,
    requestDelayMs: number,
    counters: CollectionCounters,
    signal: AbortSignal,
    fromDate?: string,
  ): Promise<boolean> {
    for (let i = 0; i < products.length; i += batchSize) {
      if (signal.aborted) return true

      const batch = products.slice(i, i + batchSize)
      const batchAborted = await this.processBatch(executionId, batch, fetchFn, requestDelayMs, counters, signal, fromDate)
      if (batchAborted) return true

      const isLastBatch = i + batchSize >= products.length
      if (!isLastBatch) {
        await sleep(batchDelayMs)
      }
    }
    return false
  }

  /** Returns true if aborted */
  private async processBatch(
    executionId: number,
    batch: readonly Product[],
    fetchFn: AdapterFetchFn,
    requestDelayMs: number,
    counters: CollectionCounters,
    signal: AbortSignal,
    fromDate?: string,
  ): Promise<boolean> {
    for (let i = 0; i < batch.length; i++) {
      if (signal.aborted) return true
      try {
        await this.processOneProduct(executionId, batch[i], fetchFn, counters, signal, fromDate)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return true
        }
        throw error
      }
      await this.updateExecutionProgress(executionId, counters)

      if (i < batch.length - 1) {
        await sleep(requestDelayMs)
      }
    }
    return false
  }

  private async processOneProduct(
    executionId: number,
    product: Product,
    fetchFn: AdapterFetchFn,
    counters: CollectionCounters,
    signal?: AbortSignal,
    fromDate?: string,
  ): Promise<void> {
    const dateRange = await this.calculateDateRange(product.id, fromDate)

    if (dateRange === null) {
      counters.skipped++
      await this.detailRepo.create({ executionId, productId: product.id, status: 'skipped', message: 'Already up to date' })
      return
    }

    try {
      const rows = await withRetry(
        () => fetchFn(product, dateRange, signal),
        { signal },
      )
      await this.priceHistoryRepo.upsertMany(rows)
      counters.succeeded++
      await this.detailRepo.create({ executionId, productId: product.id, status: 'success' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      counters.failed++
      const message = error instanceof Error ? error.message : String(error)
      log('error', `Failed to fetch prices for ${product.name} (id=${product.id}): ${message}`)
      await this.detailRepo.create({ executionId, productId: product.id, status: 'failed', message })
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
