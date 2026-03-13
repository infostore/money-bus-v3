// PRD-FEAT-011: OHLCV Price Data Table with Pagination
import { useState, useMemo, useEffect } from 'react'
import { LineChart as LineChartIcon } from 'lucide-react'
import type { PriceHistory } from '@shared/types'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { OhlcvTable } from './OhlcvTable'

const ROWS_PER_PAGE = 25

interface PriceDataTabProps {
  readonly priceHistory: readonly PriceHistory[]
  readonly currency: string
}

export function PriceDataTab({ priceHistory, currency }: PriceDataTabProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 when data changes (range switch)
  useEffect(() => {
    setCurrentPage(1)
  }, [priceHistory])

  const sortedRows = useMemo(
    () => [...priceHistory].sort((a, b) => b.date.localeCompare(a.date)),
    [priceHistory],
  )

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE))
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE
  const pageRows = sortedRows.slice(startIdx, startIdx + ROWS_PER_PAGE)

  if (sortedRows.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="수집된 가격 데이터가 없습니다."
      />
    )
  }

  return (
    <div className="space-y-4">
      <OhlcvTable rows={pageRows} currency={currency} />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            className="h-8 px-3 text-xs"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="text-xs text-surface-400">
            페이지 {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            className="h-8 px-3 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
}
