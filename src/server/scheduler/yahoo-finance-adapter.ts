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

export class YahooFinanceAdapter {
  constructor(private readonly client: YahooFinanceClient) {}

  /**
   * Fetch OHLCV data for a single product from Yahoo Finance.
   * @param code - Product symbol (e.g., 'AAPL')
   * @param productId - Product ID for PriceRow mapping
   * @param startDate - Start date as Date object
   * @param endDate - End date as Date object
   * @returns Array of PriceRow
   */
  async fetchPrices(
    code: string,
    productId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<readonly PriceRow[]> {
    const rows = await this.client.historical(code, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })

    return rows.map((row) => toPriceRow(productId, row))
  }
}
