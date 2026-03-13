// PRD-FEAT-007: ETF Detail Page
import type { PriceHistory } from '@shared/types'

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL'

/**
 * Returns the close price of the most recent date row, or null if empty.
 */
export function getLatestClose(rows: readonly PriceHistory[]): string | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return sorted[sorted.length - 1]!.close
}

/**
 * Returns the maximum close price in the given rows, or null if empty.
 * Used for 52-week high calculation (caller passes 1Y of data).
 */
export function get52WeekHigh(rows: readonly PriceHistory[]): string | null {
  if (rows.length === 0) return null
  let max = -Infinity
  let maxStr: string | null = null
  for (const row of rows) {
    const val = parseFloat(row.close)
    if (val > max) {
      max = val
      maxStr = row.close
    }
  }
  return maxStr
}

/**
 * Returns the minimum close price in the given rows, or null if empty.
 * Used for 52-week low calculation (caller passes 1Y of data).
 */
export function get52WeekLow(rows: readonly PriceHistory[]): string | null {
  if (rows.length === 0) return null
  let min = Infinity
  let minStr: string | null = null
  for (const row of rows) {
    const val = parseFloat(row.close)
    if (val < min) {
      min = val
      minStr = row.close
    }
  }
  return minStr
}

/**
 * Returns the date range (earliest and latest dates) of the given rows, or null if empty.
 */
export function getDateRange(
  rows: readonly PriceHistory[],
): { readonly from: string; readonly to: string } | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return {
    from: sorted[0]!.date,
    to: sorted[sorted.length - 1]!.date,
  }
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for the `from` param given a range key.
 * Uses today's date as the reference point.
 * For 'ALL', returns undefined (no from filter).
 */
export function rangeToFromDate(
  range: RangeKey,
  today?: Date,
): string | undefined {
  if (range === 'ALL') return undefined
  const ref = today ?? new Date()
  const d = new Date(ref)
  switch (range) {
    case '1M':
      d.setMonth(d.getMonth() - 1)
      break
    case '3M':
      d.setMonth(d.getMonth() - 3)
      break
    case '6M':
      d.setMonth(d.getMonth() - 6)
      break
    case '1Y':
      d.setFullYear(d.getFullYear() - 1)
      break
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
