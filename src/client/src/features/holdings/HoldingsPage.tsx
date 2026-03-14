// PRD-FEAT-014: Holdings Management
import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { useHoldings, useRealizedPnl } from './use-holdings'
import { useAccounts } from '../settings/use-accounts'
import { useFamilyMembers } from '../settings/use-family-members'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { HoldingsTable } from './components/HoldingsTable'
import { RealizedPnlSection } from './components/RealizedPnlSection'
import { TransactionFormDialog } from './components/TransactionFormDialog'

interface FilterState {
  readonly accountId: number | undefined
  readonly familyMemberId: number | undefined
}

export function HoldingsPage() {
  const [filter, setFilter] = useState<FilterState>({
    accountId: undefined,
    familyMemberId: undefined,
  })
  const [showForm, setShowForm] = useState(false)

  const { accounts } = useAccounts()
  const { members: familyMembers } = useFamilyMembers()

  const holdingsFilter = {
    account_id: filter.accountId,
    family_member_id: filter.familyMemberId,
  }

  const { holdings, loading, error } = useHoldings(holdingsFilter)
  const { entries: realizedPnl, loading: pnlLoading } = useRealizedPnl(holdingsFilter)

  return (
    <div className="mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">보유종목</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
        >
          거래 추가
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px]">
          <Select
            value={filter.familyMemberId ?? ''}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                familyMemberId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">전체 구성원</option>
            {familyMembers.map((fm) => (
              <option key={fm.id} value={fm.id}>
                {fm.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[200px]">
          <Select
            value={filter.accountId ?? ''}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                accountId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">전체 계좌</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Holdings table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState icon={Briefcase} title={error} />
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="선택한 조건에 해당하는 보유종목이 없습니다"
          description="거래를 추가하면 보유종목이 자동으로 계산됩니다."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-gradient-warm px-4 py-2 text-sm font-semibold text-white"
            >
              거래 추가
            </button>
          }
        />
      ) : (
        <HoldingsTable holdings={holdings} />
      )}

      {/* Realized P&L */}
      {!loading && holdings.length > 0 && (
        <RealizedPnlSection entries={realizedPnl} loading={pnlLoading} />
      )}

      {/* Transaction form dialog */}
      <TransactionFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  )
}
