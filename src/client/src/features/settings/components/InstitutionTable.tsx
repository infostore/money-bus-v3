// PRD-FEAT-002: Institution Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { Institution } from '@shared/types'

interface InstitutionTableProps {
  readonly institutions: readonly Institution[]
  readonly etfCountMap?: ReadonlyMap<string, number>
  readonly onEdit: (institution: Institution) => void
  readonly onDelete: (institution: Institution) => void
}

export function InstitutionTable({
  institutions,
  etfCountMap,
  onEdit,
  onDelete,
}: InstitutionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="py-2 pr-3 text-left font-medium">기관명</th>
            <th className="py-2 pr-3 text-right font-medium">분류</th>
            <th className="py-2 pr-3 text-right font-medium">ETF</th>
            <th className="py-2 pl-3 text-right font-medium w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {institutions.map((institution) => {
            const etfCount = etfCountMap?.get(institution.name)
            return (
              <tr
                key={institution.id}
                className="transition-colors hover:bg-surface-800/40"
              >
                <td className="py-2.5 pr-3 font-medium text-surface-200">
                  {institution.name}
                </td>
                <td className="py-2.5 pr-3 text-right text-surface-500">
                  {institution.category}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-surface-500">
                  {etfCount ?? ''}
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      className="h-7 w-7 p-0 text-surface-400 hover:text-primary-400"
                      onClick={() => onEdit(institution)}
                      aria-label={`${institution.name} 수정`}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 w-7 p-0 text-surface-400 hover:text-error-500"
                      onClick={() => onDelete(institution)}
                      aria-label={`${institution.name} 삭제`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
