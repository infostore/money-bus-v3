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
    <div className="space-y-2">
      {accountTypes.map((accountType) => (
        <div
          key={accountType.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface-800/40 px-4 py-3 transition-all duration-300 hover:bg-surface-800/60 hover:border-white/[0.08]"
        >
          <div className="flex-1">
            {accountType.short_code && (
              <span className="mr-2 inline-flex items-center rounded-md bg-surface-700/60 px-1.5 py-0.5 text-xs font-medium text-surface-300">
                {accountType.short_code}
              </span>
            )}
            <span className="font-medium text-surface-200">
              {accountType.name}
            </span>
            <span className="ml-3 text-sm text-surface-500">
              {accountType.tax_treatment}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-primary-400"
              onClick={() => onEdit(accountType)}
              aria-label={`${accountType.name} 수정`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(accountType)}
              aria-label={`${accountType.name} 삭제`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
