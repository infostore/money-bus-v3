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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="py-2 pr-3 text-left font-medium">이름</th>
            <th className="py-2 pr-3 text-left font-medium">관계</th>
            <th className="py-2 pr-3 text-right font-medium">출생연도</th>
            <th className="py-2 pl-3 text-right font-medium w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {members.map((member) => (
            <tr
              key={member.id}
              className="transition-colors hover:bg-surface-800/40"
            >
              <td className="py-2.5 pr-3 font-medium text-surface-200">
                {member.name}
              </td>
              <td className="py-2.5 pr-3 text-surface-500">
                {member.relationship}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-surface-500">
                {member.birth_year ? `${member.birth_year}년` : ''}
              </td>
              <td className="py-2.5 pl-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-primary-400"
                    onClick={() => onEdit(member)}
                    aria-label={`${member.name} 수정`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-error-500"
                    onClick={() => onDelete(member)}
                    aria-label={`${member.name} 삭제`}
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
