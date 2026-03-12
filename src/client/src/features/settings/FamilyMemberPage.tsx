// PRD-FEAT-001: Family Member Management
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FamilyMemberView } from './FamilyMemberView'
import { useRef } from 'react'

export function FamilyMemberPage() {
  const createRef = useRef<(() => void) | undefined>(undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">가족 구성원</h1>
        <Button onClick={() => createRef.current?.()} className="gap-1.5">
          <Plus size={16} />
          추가
        </Button>
      </div>
      <FamilyMemberView onCreateRef={createRef} />
    </div>
  )
}
