// PRD-FEAT-004: Product Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { Product } from '@shared/types'

const KO_NUMBER_FORMAT = new Intl.NumberFormat('ko-KR')

function formatPrice(value: string): string {
  const num = Number(value)
  if (isNaN(num)) return value
  return KO_NUMBER_FORMAT.format(num)
}

function formatReturn(value: number | null | undefined): string {
  if (value == null) return ''
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function returnColor(value: number | null | undefined): string {
  if (value == null) return 'text-surface-500'
  if (value > 0) return 'text-error-400'
  if (value < 0) return 'text-primary-400'
  return 'text-surface-500'
}

interface PriceData {
  readonly close: string
  readonly date: string
  readonly return_1w: number | null
  readonly return_1m: number | null
  readonly return_3m: number | null
  readonly return_1y: number | null
}

interface ProductTableProps {
  readonly products: readonly Product[]
  readonly priceMap?: ReadonlyMap<number, PriceData>
  readonly onEdit: (product: Product) => void
  readonly onDelete: (product: Product) => void
  readonly onDetail?: (product: Product) => void
}

export function ProductTable({
  products,
  priceMap,
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
            <th className="py-2 pr-3 text-right font-medium">현재가</th>
            <th className="py-2 pr-3 text-right font-medium">1주</th>
            <th className="py-2 pr-3 text-right font-medium">1개월</th>
            <th className="py-2 pr-3 text-right font-medium">3개월</th>
            <th className="py-2 pr-3 text-right font-medium">1년</th>
            <th className="py-2 pl-3 text-right font-medium w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {products.map((product) => (
            <tr
              key={product.id}
              className="transition-colors hover:bg-surface-800/40"
            >
              <td className="py-2.5 pr-3 tabular-nums">
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
              <td className="py-2.5 pr-3 text-right tabular-nums text-surface-300">
                {priceMap?.get(product.id)
                  ? formatPrice(priceMap.get(product.id)!.close)
                  : ''}
              </td>
              {(() => {
                const p = priceMap?.get(product.id)
                return (
                  <>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${returnColor(p?.return_1w)}`}>
                      {formatReturn(p?.return_1w)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${returnColor(p?.return_1m)}`}>
                      {formatReturn(p?.return_1m)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${returnColor(p?.return_3m)}`}>
                      {formatReturn(p?.return_3m)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${returnColor(p?.return_1y)}`}>
                      {formatReturn(p?.return_1y)}
                    </td>
                  </>
                )
              })()}
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
