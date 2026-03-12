// PRD-FEAT-001: Family Member Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { FamilyMember } from '@shared/types'

interface FamilyMemberTableProps {
  readonly members: readonly FamilyMember[]
  readonly onEdit: (member: FamilyMember) => void
  readonly onDelete: (member: FamilyMember) => void
}

export function FamilyMemberTable({
  members,
  onEdit,
  onDelete,
}: FamilyMemberTableProps) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface-800/40 px-4 py-3 transition-all duration-300 hover:bg-surface-800/60 hover:border-white/[0.08]"
        >
          <div className="flex-1">
            <span className="font-medium text-surface-200">{member.name}</span>
            <span className="ml-3 text-sm text-surface-500">
              {member.relationship}
            </span>
            {member.birth_year && (
              <span className="ml-3 text-sm text-surface-500">
                {member.birth_year}년
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-primary-400"
              onClick={() => onEdit(member)}
              aria-label={`${member.name} 수정`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(member)}
              aria-label={`${member.name} 삭제`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
