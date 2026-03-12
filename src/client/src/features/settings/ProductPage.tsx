// PRD-FEAT-004: Product Management
import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ProductView } from './ProductView'

export function ProductPage() {
  const createRef = useRef<(() => void) | undefined>(undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">종목 관리</h1>
        <Button onClick={() => createRef.current?.()} className="gap-1.5">
          <Plus size={16} />
          추가
        </Button>
      </div>
      <ProductView onCreateRef={createRef} />
    </div>
  )
}
