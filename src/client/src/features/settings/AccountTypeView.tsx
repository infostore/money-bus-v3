// PRD-FEAT-003: Account Type Management
import { useState, useMemo, type MutableRefObject } from 'react'
import { Landmark, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { AccountTypeTable } from './components/AccountTypeTable'
import { AccountTypeFormModal } from './components/AccountTypeFormModal'
import { AccountTypeDeleteModal } from './components/AccountTypeDeleteModal'
import { useAccountTypes } from './use-account-types'
import type {
  AccountType,
  CreateAccountTypePayload,
  UpdateAccountTypePayload,
} from '@shared/types'

const TAX_TREATMENT_FILTERS = ['전체', '세금우대', '일반', '연금'] as const

interface AccountTypeViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function AccountTypeView({ onCreateRef }: AccountTypeViewProps) {
  const {
    accountTypes,
    loading,
    error,
    createAccountType,
    updateAccountType,
    deleteAccountType,
  } = useAccountTypes()

  const [formOpen, setFormOpen] = useState(false)
  const [editAccountType, setEditAccountType] = useState<
    AccountType | undefined
  >()
  const [deleteTarget, setDeleteTarget] = useState<AccountType | null>(null)
  const [taxFilter, setTaxFilter] = useState<string>('전체')

  const filteredAccountTypes = useMemo(() => {
    if (taxFilter === '전체') return accountTypes
    return accountTypes.filter((at) => at.tax_treatment === taxFilter)
  }, [accountTypes, taxFilter])

  const handleEdit = (accountType: AccountType) => {
    setEditAccountType(accountType)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditAccountType(undefined)
    setFormOpen(true)
  }

  if (onCreateRef) {
    onCreateRef.current = handleCreate
  }

  const handleFormSubmit = async (
    input: CreateAccountTypePayload | UpdateAccountTypePayload,
  ) => {
    if (editAccountType) {
      await updateAccountType(editAccountType.id, input)
    } else {
      await createAccountType(input as CreateAccountTypePayload)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteAccountType(deleteTarget.id)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {TAX_TREATMENT_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={taxFilter === filter ? 'primary' : 'ghost'}
            className="h-8 px-3 text-sm"
            onClick={() => setTaxFilter(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : filteredAccountTypes.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="등록된 계좌유형이 없습니다"
              description="계좌유형을 추가하여 계좌를 관리하세요."
              action={
                taxFilter === '전체' ? (
                  <Button onClick={handleCreate} className="gap-1.5">
                    <Plus size={16} />
                    계좌유형 추가
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <AccountTypeTable
              accountTypes={filteredAccountTypes}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <AccountTypeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        accountType={editAccountType}
      />

      <AccountTypeDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        accountType={deleteTarget}
      />
    </>
  )
}
