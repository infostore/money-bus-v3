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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="py-2 pr-3 text-left font-medium">코드</th>
            <th className="py-2 pr-3 text-left font-medium">종목명</th>
            <th className="py-2 pr-3 text-right font-medium">유형</th>
            <th className="py-2 pr-3 text-right font-medium">통화</th>
            <th className="py-2 pr-3 text-right font-medium">시장</th>
            <th className="py-2 pl-3 text-right font-medium w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {products.map((product) => (
            <tr
              key={product.id}
              className="transition-colors hover:bg-surface-800/40"
            >
              <td className="py-2.5 pr-3">
                {onDetail ? (
                  <button
                    type="button"
                    className="font-medium text-surface-300 hover:text-primary-400 transition-colors cursor-pointer"
                    onClick={() => onDetail(product)}
                  >
                    {product.code ?? ''}
                  </button>
                ) : (
                  <span className="font-medium text-surface-300">
                    {product.code ?? ''}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-3 font-medium text-surface-200 max-w-xs truncate">
                {product.name}
              </td>
              <td className="py-2.5 pr-3 text-right text-surface-500">
                {product.asset_type}
              </td>
              <td className="py-2.5 pr-3 text-right text-surface-500">
                {product.currency}
              </td>
              <td className="py-2.5 pr-3 text-right text-surface-500">
                {product.exchange ?? ''}
              </td>
              <td className="py-2.5 pl-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-primary-400"
                    onClick={() => onEdit(product)}
                    aria-label={`${product.name} 수정`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-error-500"
                    onClick={() => onDelete(product)}
                    aria-label={`${product.name} 삭제`}
                  >
                    <Trash2 size={14} />
                  </Button>
                  {onDetail && (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 p-0 text-surface-400 hover:text-surface-200"
                      onClick={() => onDetail(product)}
                      aria-label={`${product.name} 상세`}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
