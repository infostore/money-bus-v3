// PRD-FEAT-011: OHLCV Price Data Table
import type { PriceHistory } from '@shared/types'

interface OhlcvTableProps {
  readonly rows: readonly PriceHistory[]
}

function formatPrice(value: string | null): string {
  if (value === null) return '—'
  const num = parseFloat(value)
  return num.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatVolume(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('ko-KR')
}

function calcReturn(current: string | null, previous: string | null): number | null {
  if (current === null || previous === null) return null
  const curr = parseFloat(current)
  const prev = parseFloat(previous)
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function formatReturn(value: number | null): string {
  if (value === null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function returnColor(value: number | null): string {
  if (value === null) return 'text-surface-400'
  if (value > 0) return 'text-success-500'
  if (value < 0) return 'text-error-500'
  return 'text-surface-400'
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function OhlcvTable({ rows }: OhlcvTableProps) {
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
            <th className="px-3 py-2 text-right">수익률</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">거래량</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prevClose = rows[i + 1]?.close ?? null
            const ret = calcReturn(row.close, prevClose)
            return (
              <tr
                key={row.date}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2 text-surface-300">{formatDate(row.date)}</td>
                <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.open)}</td>
                <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.high)}</td>
                <td className="px-3 py-2 text-right text-surface-300">{formatPrice(row.low)}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-200">{formatPrice(row.close)}</td>
                <td className={`px-3 py-2 text-right font-medium ${returnColor(ret)}`}>{formatReturn(ret)}</td>
                <td className="hidden px-3 py-2 text-right text-surface-300 sm:table-cell">{formatVolume(row.volume)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
