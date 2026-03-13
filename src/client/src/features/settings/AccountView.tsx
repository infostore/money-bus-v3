// PRD-FEAT-010: Account Management
import { useState, useMemo, useCallback, type MutableRefObject } from 'react'
import { Wallet, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { AccountTable } from './components/AccountTable'
import { AccountFormModal } from './components/AccountFormModal'
import { AccountDeleteModal } from './components/AccountDeleteModal'
import { useAccounts } from './use-accounts'
import { useFamilyMembers } from './use-family-members'
import type {
  AccountWithDetails,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@shared/types'

const STORAGE_KEY_OWNER = 'account-filter-owner'

function loadFilter(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function saveFilter(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full or unavailable — ignore
  }
}

interface AccountViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function AccountView({ onCreateRef }: AccountViewProps) {
  const {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useAccounts()

  const { members: familyMembers } = useFamilyMembers()

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountWithDetails | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<AccountWithDetails | null>(null)
  const [ownerFilter, setOwnerFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_OWNER, '전체'),
  )

  const handleOwnerChange = useCallback((value: string) => {
    setOwnerFilter(value)
    saveFilter(STORAGE_KEY_OWNER, value)
  }, [])

  const filteredAccounts = useMemo(() => {
    if (ownerFilter === '전체') return accounts
    return accounts.filter((a) => a.family_member_name === ownerFilter)
  }, [accounts, ownerFilter])

  const ownerOptions = useMemo(() => {
    return ['전체', ...familyMembers.map((m) => m.name)] as const
  }, [familyMembers])

  const handleEdit = (account: AccountWithDetails) => {
    setEditAccount(account)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditAccount(undefined)
    setFormOpen(true)
  }

  if (onCreateRef) {
    onCreateRef.current = handleCreate
  }

  const handleFormSubmit = async (
    input: CreateAccountPayload | UpdateAccountPayload,
  ) => {
    if (editAccount) {
      await updateAccount(editAccount.id, input)
    } else {
      await createAccount(input as CreateAccountPayload)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteAccount(deleteTarget.id)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {ownerOptions.map((filter) => (
            <Button
              key={filter}
              variant={ownerFilter === filter ? 'primary' : 'ghost'}
              className="h-8 px-3 text-sm"
              onClick={() => handleOwnerChange(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : filteredAccounts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={
                ownerFilter === '전체'
                  ? '등록된 계좌가 없습니다'
                  : '해당 구성원의 계좌가 없습니다.'
              }
              description={
                ownerFilter === '전체'
                  ? '계좌를 추가하여 자산을 관리하세요.'
                  : undefined
              }
              action={
                ownerFilter === '전체' ? (
                  <Button onClick={handleCreate} className="gap-1.5">
                    <Plus size={16} />
                    계좌 추가
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <AccountTable
              accounts={filteredAccounts}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <AccountFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        account={editAccount}
      />

      <AccountDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        account={deleteTarget}
      />
    </>
  )
}
