// PRD-FEAT-013: ETF Component UI
import { Layers } from 'lucide-react'
import { Spinner } from '../../../components/ui/Spinner'
import { EmptyState } from '../../../components/ui/EmptyState'
import { useEtfHoldings } from '../use-etf-holdings'

interface EtfHoldingsTabProps {
  readonly productId: number
}

function formatWeight(weight: string | null): string {
  if (weight === null) return '—'
  const num = parseFloat(weight)
  return `${num.toFixed(2)}%`
}

function formatShares(shares: number | null): string {
  if (shares === null) return '—'
  return shares.toLocaleString('ko-KR')
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function EtfHoldingsTab({ productId }: EtfHoldingsTabProps) {
  const { dates, selectedDate, setSelectedDate, components, loading, error, hasData } =
    useEtfHoldings(productId)

  if (loading && !hasData) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-error-500/10 border border-error-500/20 px-4 py-3 text-sm text-error-500">
        {error}
      </div>
    )
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={Layers}
        title="구성종목 데이터가 없습니다."
        description="ETF 구성종목 수집 스케줄러를 실행한 후 확인하세요."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="snapshot-date" className="text-sm text-surface-400">
          스냅샷 날짜
        </label>
        <select
          id="snapshot-date"
          value={selectedDate ?? ''}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-surface-900 px-3 py-1.5 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {dates.map((date) => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>
        <span className="text-xs text-surface-500">{components.length}개 종목</span>
      </div>

      {components.length === 0 && selectedDate ? (
        <EmptyState
          icon={Layers}
          title="해당 날짜의 구성종목 데이터가 없습니다."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-surface-500">
                <th className="px-4 py-3 text-left font-medium">종목코드</th>
                <th className="px-4 py-3 text-left font-medium">종목명</th>
                <th className="px-4 py-3 text-right font-medium">비중</th>
                <th className="px-4 py-3 text-right font-medium">보유수량</th>
              </tr>
            </thead>
            <tbody>
              {components.map((comp) => (
                <tr
                  key={comp.id}
                  className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-surface-300">
                    {comp.component_symbol}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-200">
                    {comp.component_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-primary-400">
                    {formatWeight(comp.weight)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-surface-400">
                    {formatShares(comp.shares)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
