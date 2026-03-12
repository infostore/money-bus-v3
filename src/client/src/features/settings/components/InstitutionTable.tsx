// PRD-FEAT-002: Institution Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { Institution } from '@shared/types'

interface InstitutionTableProps {
  readonly institutions: readonly Institution[]
  readonly onEdit: (institution: Institution) => void
  readonly onDelete: (institution: Institution) => void
}

export function InstitutionTable({
  institutions,
  onEdit,
  onDelete,
}: InstitutionTableProps) {
  return (
    <div className="space-y-2">
      {institutions.map((institution) => (
        <div
          key={institution.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface-800/40 px-4 py-3 transition-all duration-300 hover:bg-surface-800/60 hover:border-white/[0.08]"
        >
          <div className="flex-1">
            <span className="font-medium text-surface-200">{institution.name}</span>
            <span className="ml-3 text-sm text-surface-500">
              {institution.category}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-primary-400"
              onClick={() => onEdit(institution)}
              aria-label={`${institution.name} 수정`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(institution)}
              aria-label={`${institution.name} 삭제`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
