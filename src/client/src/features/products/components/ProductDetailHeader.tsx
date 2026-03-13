// PRD-FEAT-007: ETF Detail Page
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { Product } from '@shared/types'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'

interface ProductDetailHeaderProps {
  readonly product: Product
}

export function ProductDetailHeader({ product }: ProductDetailHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-start gap-4">
      <Button
        variant="ghost"
        className="mt-1 h-8 w-8 p-0"
        onClick={() => navigate({ to: '/products' })}
        aria-label="목록으로 돌아가기"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-surface-100">
          {product.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {product.code && (
            <Badge variant="default">{product.code}</Badge>
          )}
          {product.exchange && (
            <Badge variant="outline">{product.exchange}</Badge>
          )}
          <Badge variant="outline">{product.currency}</Badge>
          <Badge variant="warning">{product.asset_type}</Badge>
        </div>
      </div>
    </div>
  )
}
