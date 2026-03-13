// PRD-FEAT-007: ETF Detail Page
import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import type { PriceHistory } from '@shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { CHART_COLORS } from '../../../lib/design-tokens'
import type { RangeKey } from '../price-history-utils'

interface PriceHistoryChartProps {
  readonly priceHistory: readonly PriceHistory[]
  readonly range: RangeKey
  readonly onRangeChange: (range: RangeKey) => void
  readonly currency: string
}

interface ChartDataPoint {
  readonly date: string
  readonly close: number
}

const RANGE_OPTIONS: readonly { readonly key: RangeKey; readonly label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: '전체' },
] as const

function formatTick(dateStr: string): string {
  const parts = dateStr.split('-')
  return `${parts[1]}/${parts[2]}`
}

function formatTooltipDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function PriceHistoryChart({
  priceHistory,
  range,
  onRangeChange,
  currency,
}: PriceHistoryChartProps) {
  const chartData: readonly ChartDataPoint[] = useMemo(
    () =>
      [...priceHistory]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row) => ({
          date: row.date,
          close: parseFloat(row.close),
        })),
    [priceHistory],
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">가격 추이</CardTitle>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={range === opt.key ? 'primary' : 'ghost'}
                className="h-7 px-2.5 text-xs"
                onClick={() => onRangeChange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="수집된 가격 데이터가 없습니다."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData as ChartDataPoint[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString('ko-KR')}
                domain={['auto', 'auto']}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1c1917',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(label) => formatTooltipDate(String(label))}
                formatter={(value) => [
                  `${Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`,
                  '종가',
                ]}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.primary }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
