// PRD-FEAT-004: Product Management
import { ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { Product } from '@shared/types'

interface ProductTableProps {
  readonly products: readonly Product[]
  readonly onEdit: (product: Product) => void
  readonly onDelete: (product: Product) => void
  readonly onDetail?: (product: Product) => void
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  onDetail,
}: ProductTableProps) {
  return (
    <div className="space-y-2">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface-800/40 px-4 py-3 transition-all duration-300 hover:bg-surface-800/60 hover:border-white/[0.08]"
        >
          <div className="grid grid-cols-[4rem_1fr_3rem_3rem_4rem] items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-medium text-surface-300 truncate">
              {product.code ?? ''}
            </span>
            <span className="font-medium text-surface-200 truncate">
              {product.name}
            </span>
            <span className="text-xs text-surface-500 text-right truncate">
              {product.asset_type}
            </span>
            <span className="text-xs text-surface-500 text-right truncate">
              {product.currency}
            </span>
            <span className="text-xs text-surface-500 text-right truncate">
              {product.exchange ?? ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-primary-400"
              onClick={() => onEdit(product)}
              aria-label={`${product.name} 수정`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(product)}
              aria-label={`${product.name} 삭제`}
            >
              <Trash2 size={14} />
            </Button>
            {onDetail && (
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-surface-400 hover:text-surface-200"
                onClick={() => onDetail(product)}
                aria-label={`${product.name} 상세`}
              >
                <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
