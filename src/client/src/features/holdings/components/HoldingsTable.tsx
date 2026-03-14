// PRD-FEAT-014: Holdings Management
import { useNavigate } from '@tanstack/react-router'
import type { HoldingWithDetails } from '@shared/types'

interface HoldingsTableProps {
  readonly holdings: readonly HoldingWithDetails[]
}

function formatNumber(value: number | null, fractionDigits = 0): string {
  if (value === null) return '-'
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function priceDigits(currency: string): number {
  return currency === 'KRW' ? 0 : 2
}

function formatDecimal(value: number | null, digits = 2): string {
  if (value === null) return '-'
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatPercent(value: number | null): string {
  if (value === null) return '-'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function pnlColor(value: number | null): string {
  if (value === null) return 'text-surface-400'
  if (value > 0) return 'text-success-500'
  if (value < 0) return 'text-error-500'
  return 'text-surface-300'
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs text-surface-400">
            <th className="px-3 py-2">종목명</th>
            <th className="px-3 py-2 text-right">보유수량</th>
            <th className="px-3 py-2 text-right">평균단가</th>
            <th className="px-3 py-2 text-right">현재가</th>
            <th className="px-3 py-2 text-right">평가금액</th>
            <th className="px-3 py-2 text-right">손익(미실현)</th>
            <th className="px-3 py-2 text-right">수익률</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell" title="비중은 필터 기준 합산 기준입니다">
              비중
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr
              key={`${h.account_id}-${h.product_id}`}
              className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
              onClick={() =>
                navigate({
                  to: '/holdings/$accountId/$productId',
                  params: {
                    accountId: String(h.account_id),
                    productId: String(h.product_id),
                  },
                })
              }
            >
              <td className="px-3 py-2">
                <div className="font-medium text-surface-100">{h.product_name}</div>
                <div className="text-xs text-surface-400">
                  {h.institution_name} · {h.family_member_name}
                </div>
              </td>
              <td className="px-3 py-2 text-right text-surface-300">
                {formatDecimal(h.shares, 0)}
              </td>
              <td className="px-3 py-2 text-right text-surface-300">
                {formatDecimal(h.avg_cost)}
              </td>
              <td className="px-3 py-2 text-right text-surface-300">
                {formatNumber(h.current_price, priceDigits(h.currency))}
              </td>
              <td className="px-3 py-2 text-right text-surface-200">
                {formatNumber(h.market_value)}
              </td>
              <td className={`px-3 py-2 text-right font-medium ${pnlColor(h.unrealized_pnl)}`}>
                {formatNumber(h.unrealized_pnl)}
              </td>
              <td className={`px-3 py-2 text-right ${pnlColor(h.unrealized_pnl_percent)}`}>
                {formatPercent(h.unrealized_pnl_percent)}
              </td>
              <td className="hidden px-3 py-2 text-right text-surface-400 sm:table-cell">
                {h.weight !== null ? `${h.weight.toFixed(1)}%` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
