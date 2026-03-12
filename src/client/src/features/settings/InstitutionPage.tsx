// PRD-FEAT-002: Institution Management
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { InstitutionView } from './InstitutionView'
import { useRef } from 'react'

export function InstitutionPage() {
  const createRef = useRef<(() => void) | undefined>(undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">금융기관</h1>
        <Button onClick={() => createRef.current?.()} className="gap-1.5">
          <Plus size={16} />
          추가
        </Button>
      </div>
      <InstitutionView onCreateRef={createRef} />
    </div>
  )
}
