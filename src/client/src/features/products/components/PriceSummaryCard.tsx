// PRD-FEAT-007: ETF Detail Page
import type { PriceHistory } from '@shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import {
  getLatestClose,
  get52WeekHigh,
  get52WeekLow,
  getDateRange,
} from '../price-history-utils'

interface PriceSummaryCardProps {
  readonly summaryHistory: readonly PriceHistory[]
  readonly currency: string
}

function formatPrice(value: string | null, currency: string): string {
  if (value === null) return '-'
  const num = parseFloat(value)
  return `${num.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function PriceSummaryCard({ summaryHistory, currency }: PriceSummaryCardProps) {
  if (summaryHistory.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-surface-400">가격 데이터 없음</p>
        </CardContent>
      </Card>
    )
  }

  const latestClose = getLatestClose(summaryHistory)
  const high52w = get52WeekHigh(summaryHistory)
  const low52w = get52WeekLow(summaryHistory)
  const dateRange = getDateRange(summaryHistory)

  const stats = [
    { label: '최근 종가', value: formatPrice(latestClose, currency) },
    { label: '52주 최고', value: formatPrice(high52w, currency) },
    { label: '52주 최저', value: formatPrice(low52w, currency) },
    {
      label: '데이터 기간',
      value: dateRange ? `${formatDate(dateRange.from)} ~ ${formatDate(dateRange.to)}` : '-',
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">가격 요약</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-surface-400">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-surface-100">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
