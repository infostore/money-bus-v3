// PRD-FEAT-014: Holdings Management
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Spinner } from '../../../components/ui/Spinner'
import type { RealizedPnlEntry } from '@shared/types'

interface RealizedPnlSectionProps {
  readonly entries: readonly RealizedPnlEntry[]
  readonly loading: boolean
}

function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function pnlColor(value: number): string {
  if (value > 0) return 'text-success-500'
  if (value < 0) return 'text-error-500'
  return 'text-surface-300'
}

export function RealizedPnlSection({ entries, loading }: RealizedPnlSectionProps) {
  const [expanded, setExpanded] = useState(false)

  const totalNetPnl = entries.reduce((sum, e) => sum + e.net_pnl, 0)

  return (
    <div className="rounded-lg border border-white/[0.06]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-surface-200">실현손익</span>
          {!loading && (
            <span className={`text-sm font-medium ${pnlColor(totalNetPnl)}`}>
              {totalNetPnl >= 0 ? '+' : ''}{formatNumber(totalNetPnl)}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-4 py-4 text-sm text-surface-400">실현 손익 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-surface-400">
                    <th className="px-3 py-2">거래일</th>
                    <th className="px-3 py-2">종목</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">매도가</th>
                    <th className="px-3 py-2 text-right">평균원가</th>
                    <th className="px-3 py-2 text-right">실현손익</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.transaction_id}
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 text-surface-300">
                        {e.traded_at.replace(/-/g, '.')}
                      </td>
                      <td className="px-3 py-2 text-surface-200">{e.product_name}</td>
                      <td className="px-3 py-2 text-right text-surface-300">{e.shares}</td>
                      <td className="px-3 py-2 text-right text-surface-300">
                        {formatNumber(e.sell_price)}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-300">
                        {formatNumber(e.avg_cost_at_sell)}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${pnlColor(e.net_pnl)}`}>
                        {e.net_pnl >= 0 ? '+' : ''}{formatNumber(e.net_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
