// PRD-FEAT-011: OHLCV Price Data Table
import type { PriceHistory } from '@shared/types'

interface OhlcvTableProps {
  readonly rows: readonly PriceHistory[]
  readonly currency: string
}

function formatPrice(value: string | null, currency: string): string {
  if (value === null) return '—'
  const num = parseFloat(value)
  return `${num.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
}

function formatVolume(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('ko-KR')
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function OhlcvTable({ rows, currency }: OhlcvTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs text-surface-400">
            <th className="px-3 py-2">날짜</th>
            <th className="px-3 py-2 text-right">시가</th>
            <th className="px-3 py-2 text-right">고가</th>
            <th className="px-3 py-2 text-right">저가</th>
            <th className="px-3 py-2 text-right">종가</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">거래량</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.date}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-3 py-2 text-surface-300">{formatDate(row.date)}</td>
              <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.open, currency)}</td>
              <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.high, currency)}</td>
              <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.low, currency)}</td>
              <td className="px-3 py-2 text-right font-medium text-surface-200">{formatPrice(row.close, currency)}</td>
              <td className="hidden px-3 py-2 text-right text-surface-300 sm:table-cell">{formatVolume(row.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
