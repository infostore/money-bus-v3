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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="py-2 pr-3 text-left font-medium">계좌명</th>
            <th className="py-2 pr-3 text-left font-medium">계좌번호</th>
            <th className="py-2 pr-3 text-left font-medium">소유자</th>
            <th className="py-2 pr-3 text-left font-medium">금융기관</th>
            <th className="py-2 pr-3 text-right font-medium">계좌유형</th>
            <th className="py-2 pl-3 text-right font-medium w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {accounts.map((account) => (
            <tr
              key={account.id}
              className="transition-colors hover:bg-surface-800/40"
            >
              <td className="py-2.5 pr-3 font-medium text-surface-200 max-w-xs truncate">
                {account.account_name}
              </td>
              <td className="py-2.5 pr-3 text-surface-400">
                {account.account_number
                  ? maskAccountNumber(account.account_number)
                  : '-'}
              </td>
              <td className="py-2.5 pr-3 text-surface-500">
                {account.family_member_name}
              </td>
              <td className="py-2.5 pr-3 text-surface-500">
                {account.institution_name}
              </td>
              <td className="py-2.5 pr-3 text-right text-surface-500">
                {account.account_type_short_code ?? account.account_type_name}
              </td>
              <td className="py-2.5 pl-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-primary-400"
                    onClick={() => onEdit(account)}
                    aria-label={`${account.account_name} 수정`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 text-surface-400 hover:text-error-500"
                    onClick={() => onDelete(account)}
                    aria-label={`${account.account_name} 삭제`}
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
