// PRD-FEAT-005: Price History Scheduler
import type { PriceRow } from '../database/price-history-repository.js'

export interface YahooHistoricalRow {
  readonly date: Date
  readonly open: number
  readonly high: number
  readonly low: number
  readonly close: number
  readonly volume: number
}

export interface YahooFinanceClient {
  historical(
    symbol: string,
    queryOptions: { readonly period1: Date; readonly period2: Date; readonly interval: '1d' },
  ): Promise<readonly YahooHistoricalRow[]>
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function toPriceRow(productId: number, row: YahooHistoricalRow): PriceRow {
  return {
    productId,
    date: formatDate(row.date),
    open: row.open.toString(),
    high: row.high.toString(),
    low: row.low.toString(),
    close: row.close.toString(),
    volume: row.volume,
  }
}

const FETCH_TIMEOUT_MS = parseInt(process.env['PRICE_FETCH_TIMEOUT_MS'] ?? '30000', 10)

export class YahooFinanceAdapter {
  constructor(private readonly client: YahooFinanceClient) {}

  /**
   * Fetch OHLCV data for a single product from Yahoo Finance.
   * @param code - Product symbol (e.g., 'AAPL')
   * @param productId - Product ID for PriceRow mapping
   * @param startDate - Start date as Date object
   * @param endDate - End date as Date object
   * @param signal - Optional AbortSignal for cancellation
   * @returns Array of PriceRow
   */
  async fetchPrices(
    code: string,
    productId: number,
    startDate: Date,
    endDate: Date,
    signal?: AbortSignal,
  ): Promise<readonly PriceRow[]> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DOMException('Timeout', 'TimeoutError')),
          FETCH_TIMEOUT_MS,
        )
        signal?.addEventListener('abort', () => {
          if (timer) clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })

      const fetchPromise = this.client.historical(code, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      })

      const rows = await Promise.race([fetchPromise, timeoutPromise])
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      return rows.map((row) => toPriceRow(productId, row))
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
