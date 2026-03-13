// PRD-FEAT-007: ETF Detail Page
import { useState } from 'react'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useProductDetail } from './use-product-detail'
import { ProductDetailHeader } from './components/ProductDetailHeader'
import { PriceSummaryCard } from './components/PriceSummaryCard'
import { PriceHistoryChart } from './components/PriceHistoryChart'
import type { RangeKey } from './price-history-utils'

const routeApi = getRouteApi('/products/$id')

export function ProductDetailPage() {
  const { id: rawId } = routeApi.useParams()
  const navigate = useNavigate()
  const [range, setRange] = useState<RangeKey>('1Y')

  const id = parseInt(rawId, 10)

  if (isNaN(id)) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert variant="error">
          <div className="flex items-center justify-between">
            <span>종목을 찾을 수 없습니다.</span>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => navigate({ to: '/products' })}
            >
              목록으로 돌아가기
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  return <ProductDetailContent id={id} range={range} onRangeChange={setRange} />
}

interface ProductDetailContentProps {
  readonly id: number
  readonly range: RangeKey
  readonly onRangeChange: (range: RangeKey) => void
}

function ProductDetailContent({ id, range, onRangeChange }: ProductDetailContentProps) {
  const navigate = useNavigate()
  const { product, priceHistory, summaryHistory, loading, productError } =
    useProductDetail(id, range)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (productError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert variant="error" title="오류">
          <div className="flex items-center justify-between">
            <span>{productError}</span>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => navigate({ to: '/products' })}
            >
              목록으로 돌아가기
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert variant="error">
          <div className="flex items-center justify-between">
            <span>종목을 찾을 수 없습니다.</span>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => navigate({ to: '/products' })}
            >
              목록으로 돌아가기
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <ProductDetailHeader product={product} />
      <PriceSummaryCard
        summaryHistory={summaryHistory}
        currency={product.currency}
      />
      <PriceHistoryChart
        priceHistory={priceHistory}
        range={range}
        onRangeChange={onRangeChange}
        currency={product.currency}
      />
    </div>
  )
}
