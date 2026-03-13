// PRD-FEAT-005: Price History Scheduler
import type { PriceRow } from '../database/price-history-repository.js'

const NAVER_SISE_BASE_URL =
  'https://api.finance.naver.com/siseJson.naver'

const DATE_RAW_LENGTH = 8
const IDX_DATE = 0
const IDX_OPEN = 1
const IDX_HIGH = 2
const IDX_LOW = 3
const IDX_CLOSE = 4
const IDX_VOLUME = 5

/**
 * Sanitize Naver Finance response text into valid JSON.
 * Naver may return single-quoted strings and trailing commas.
 */
function sanitizeNaverText(raw: string): string {
  return raw
    .replace(/'/g, '"')
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}')
    .trim()
}

/**
 * Convert YYYYMMDD to YYYY-MM-DD.
 */
function formatDate(raw: string): string {
  const cleaned = raw.replace(/"/g, '').trim()
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, DATE_RAW_LENGTH)}`
}

/**
 * Parse Naver Finance siseJson response text into PriceRow array.
 * Exported for direct unit testing.
 */
export function parseNaverResponse(
  text: string,
  productId: number,
): readonly PriceRow[] {
  const sanitized = sanitizeNaverText(text)
  if (!sanitized) {
    return []
  }

  let parsed: unknown[][]
  try {
    parsed = JSON.parse(sanitized) as unknown[][]
  } catch {
    return []
  }

  if (!Array.isArray(parsed) || parsed.length <= 1) {
    return []
  }

  // Skip header row (index 0)
  return parsed.slice(1).map((row) => ({
    productId,
    date: formatDate(String(row[IDX_DATE])),
    open: row[IDX_OPEN] != null ? String(row[IDX_OPEN]) : null,
    high: row[IDX_HIGH] != null ? String(row[IDX_HIGH]) : null,
    low: row[IDX_LOW] != null ? String(row[IDX_LOW]) : null,
    close: String(row[IDX_CLOSE]),
    volume: row[IDX_VOLUME] != null ? Number(row[IDX_VOLUME]) : null,
  }))
}

const FETCH_TIMEOUT_MS = parseInt(process.env['PRICE_FETCH_TIMEOUT_MS'] ?? '30000', 10)

export class NaverFinanceAdapter {
  constructor(
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  ) {}

  /**
   * Fetch OHLCV data for a single product from Naver Finance.
   * @param code - Product code (e.g., '005930')
   * @param productId - Product ID for PriceRow mapping
   * @param startDate - Start date YYYYMMDD
   * @param endDate - End date YYYYMMDD
   * @param signal - Optional AbortSignal for cancellation
   * @returns Array of PriceRow
   */
  async fetchPrices(
    code: string,
    productId: number,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<readonly PriceRow[]> {
    const url = `${NAVER_SISE_BASE_URL}?symbol=${code}&requestType=1&startTime=${startDate}&endTime=${endDate}&timeframe=day`
    const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal
    const response = await this.fetchFn(url, { signal: combinedSignal })
    const text = await response.text()

    return parseNaverResponse(text, productId)
  }
}
