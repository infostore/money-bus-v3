// PRD-FEAT-010: Account Management
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { AccountWithDetails } from '@shared/types'

interface AccountTableProps {
  readonly accounts: readonly AccountWithDetails[]
  readonly onEdit: (account: AccountWithDetails) => void
  readonly onDelete: (account: AccountWithDetails) => void
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 6) return accountNumber
  const start = accountNumber.slice(0, 3)
  const end = accountNumber.slice(-3)
  const middle = accountNumber.slice(3, -3).replace(/[0-9]/g, '*')
  return `${start}${middle}${end}`
}

export function AccountTable({
  accounts,
  onEdit,
  onDelete,
}: AccountTableProps) {
  return (
    <div className="space-y-2">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface-800/40 px-4 py-3 transition-all duration-300 hover:bg-surface-800/60 hover:border-white/[0.08]"
        >
          <div className="grid grid-cols-[1fr_7rem_6rem_6rem_5rem] items-center gap-3 flex-1 min-w-0">
            <span className="font-medium text-surface-200 truncate">
              {account.account_name}
            </span>
            <span className="text-sm text-surface-400 truncate">
              {account.account_number
                ? maskAccountNumber(account.account_number)
                : '-'}
            </span>
            <span className="text-xs text-surface-500 truncate">
              {account.family_member_name}
            </span>
            <span className="text-xs text-surface-500 truncate">
              {account.institution_name}
            </span>
            <span className="text-xs text-surface-500 truncate">
              {account.account_type_name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-primary-400"
              onClick={() => onEdit(account)}
              aria-label={`${account.account_name} 수정`}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-surface-400 hover:text-error-500"
              onClick={() => onDelete(account)}
              aria-label={`${account.account_name} 삭제`}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
