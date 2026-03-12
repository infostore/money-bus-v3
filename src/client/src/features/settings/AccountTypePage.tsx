// PRD-FEAT-003: Account Type Management
import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { AccountTypeView } from './AccountTypeView'

export function AccountTypePage() {
  const createRef = useRef<(() => void) | undefined>(undefined)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">계좌유형</h1>
        <Button onClick={() => createRef.current?.()} className="gap-1.5">
          <Plus size={16} />
          추가
        </Button>
      </div>
      <AccountTypeView onCreateRef={createRef} />
    </div>
  )
}
