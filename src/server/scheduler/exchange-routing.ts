// PRD-FEAT-005: Price History Scheduler

const DOMESTIC_EXCHANGES: ReadonlySet<string> = new Set([
  'KRX',
  'KOSPI',
  'KOSDAQ',
])

const FOREIGN_EXCHANGES: ReadonlySet<string> = new Set([
  'NASDAQ',
  'NYSE',
  'AMEX',
  'TSX',
])

export type AdapterType = 'naver' | 'yahoo' | 'unknown'

/**
 * Resolve the price data adapter based on exchange name.
 *
 * @param exchange - Exchange identifier or null
 * @returns Adapter type: 'naver' for domestic, 'yahoo' for foreign, 'unknown' otherwise
 */
export function resolveAdapter(exchange: string | null): AdapterType {
  if (exchange === null || exchange === '') {
    return 'unknown'
  }

  if (DOMESTIC_EXCHANGES.has(exchange)) {
    return 'naver'
  }

  if (FOREIGN_EXCHANGES.has(exchange)) {
    return 'yahoo'
  }

  return 'unknown'
}
