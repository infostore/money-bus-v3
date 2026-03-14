// PRD-FEAT-007 + PRD-FEAT-011 + PRD-FEAT-013: ETF Detail Page with Tabs
import { useState } from 'react'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { cn } from '../../lib/utils'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useProductDetail } from './use-product-detail'
import { ProductDetailHeader } from './components/ProductDetailHeader'
import { PriceSummaryCard } from './components/PriceSummaryCard'
import { PriceHistoryChart } from './components/PriceHistoryChart'
import { PriceDataTab } from './components/PriceDataTab'
import { EtfHoldingsTab } from './components/EtfHoldingsTab'
import type { RangeKey } from './price-history-utils'

type TabKey = 'chart' | 'table' | 'holdings'

const BASE_TAB_OPTIONS: readonly { readonly key: TabKey; readonly label: string }[] = [
  { key: 'chart', label: '가격 차트' },
  { key: 'table', label: '가격 데이터' },
] as const

const HOLDINGS_TAB = { key: 'holdings' as const, label: '구성종목' }

const routeApi = getRouteApi('/products/$id')

export function ProductDetailPage() {
  const { id: rawId } = routeApi.useParams()
  const { tab } = routeApi.useSearch()
  const navigate = useNavigate()
  const [range, setRange] = useState<RangeKey>('1Y')

  const id = parseInt(rawId, 10)

  const handleTabChange = (newTab: TabKey) => {
    navigate({
      to: '/products/$id',
      params: { id: rawId },
      search: { tab: newTab },
    })
  }

  if (isNaN(id)) {
    return (
      <div className="mx-auto p-6">
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
    <ProductDetailContent
      id={id}
      range={range}
      onRangeChange={setRange}
      tab={tab}
      onTabChange={handleTabChange}
    />
  )
}

interface ProductDetailContentProps {
  readonly id: number
  readonly range: RangeKey
  readonly onRangeChange: (range: RangeKey) => void
  readonly tab: TabKey
  readonly onTabChange: (tab: TabKey) => void
}

function ProductDetailContent({
  id,
  range,
  onRangeChange,
  tab,
  onTabChange,
}: ProductDetailContentProps) {
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
      <div className="mx-auto p-6">
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
      <div className="mx-auto p-6">
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

  const isEtf = product.asset_type.toLowerCase().includes('etf')
  const tabOptions = isEtf
    ? [...BASE_TAB_OPTIONS, HOLDINGS_TAB]
    : [...BASE_TAB_OPTIONS]

  return (
    <div className="mx-auto space-y-6 p-6">
      <ProductDetailHeader product={product} />
      <PriceSummaryCard summaryHistory={summaryHistory} />
      <div className="flex gap-1">
        {tabOptions.map((opt) => (
          <Button
            key={opt.key}
            variant={tab === opt.key ? 'primary' : 'ghost'}
            className={cn(
              'h-9 px-4 text-sm',
              tab === opt.key && 'shadow-glow-sm',
            )}
            onClick={() => onTabChange(opt.key)}
            aria-pressed={tab === opt.key}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {tab === 'chart' ? (
        <PriceHistoryChart
          priceHistory={priceHistory}
          range={range}
          onRangeChange={onRangeChange}
          currency={product.currency}
        />
      ) : tab === 'holdings' && isEtf ? (
        <EtfHoldingsTab productId={id} />
      ) : (
        <PriceDataTab priceHistory={priceHistory} />
      )}
    </div>
  )
}
