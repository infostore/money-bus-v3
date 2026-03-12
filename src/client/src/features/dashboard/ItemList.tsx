import { Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { ItemData } from '@shared/types'

interface ItemListProps {
  readonly items: ItemData[]
  readonly onDelete: (id: number) => void
}

export function ItemList({ items, onDelete }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-surface-500">
        No items yet. Add one above.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-xl border border-black/[0.04] bg-white/40 px-4 py-3 transition-all duration-300 hover:bg-white/60 hover:border-black/[0.08]"
        >
          <div className="flex-1">
            <span className="font-medium">{item.name}</span>
            <span className="ml-3 text-sm text-surface-500">
              {item.category}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary-600">
              {item.value.toLocaleString()}
            </span>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
