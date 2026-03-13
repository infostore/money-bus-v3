// PRD-FEAT-003: Account Type Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { AccountType } from '@shared/types'

interface AccountTypeTableProps {
  readonly accountTypes: readonly AccountType[]
  readonly onEdit: (accountType: AccountType) => void
  readonly onDelete: (accountType: AccountType) => void
}

export function AccountTypeTable({
  accountTypes,
  onEdit,
  onDelete,
}: AccountTypeTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="py-2 pr-3 text-left font-medium">코드</th>
            <th className="py-2 pr-3 text-left font-medium">유형명</th>
            <th className="py-2 pr-3 text-right font-medium">과세</th>
            <th className="py-2 pl-3 text-right font-medium w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {accountTypes.map((accountType) => (
            <tr
              key={accountType.id}
              className="transition-colors hover:bg-surface-800/40"
            >
              <td className="py-2.5 pr-3 font-medium text-surface-300">
                {accountType.short_code ?? ''}
              </td>
              <td className="py-2.5 pr-3 font-medium text-surface-200">
                {accountType.name}
              </td>
              <td className="py-2.5 pr-3 text-right text-surface-500">
                {accountType.tax_treatment}
              </td>
              <td className="py-2.5 pl-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-primary-400"
                    onClick={() => onEdit(accountType)}
                    aria-label={`${accountType.name} 수정`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-error-500"
                    onClick={() => onDelete(accountType)}
                    aria-label={`${accountType.name} 삭제`}
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
