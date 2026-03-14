// PRD-FEAT-014: Holdings Management — Holding Detail Page
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useHoldings } from './use-holdings'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { TransactionList } from './components/TransactionList'
import { TransactionFormDialog } from './components/TransactionFormDialog'
import type { Transaction } from '@shared/types'

function formatNumber(value: number | null): string {
  if (value === null) return '-'
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
}

function formatPercent(value: number | null): string {
  if (value === null) return '-'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function pnlColor(value: number | null): string {
  if (value === null) return 'text-surface-400'
  if (value > 0) return 'text-error-500'
  if (value < 0) return 'text-blue-400'
  return 'text-surface-300'
}

export function HoldingDetailPage() {
  const navigate = useNavigate()
  const { accountId, productId } = useParams({ strict: false }) as {
    accountId: string
    productId: string
  }

  const aId = parseInt(accountId, 10)
  const pId = parseInt(productId, 10)

  const { holdings, loading } = useHoldings({ account_id: aId })
  const holding = holdings.find((h) => h.product_id === pId)

  const [showForm, setShowForm] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | undefined>(undefined)

  const handleEdit = (txn: Transaction) => {
    setEditingTxn(txn)
    setShowForm(true)
  }

  const handleOpenCreate = () => {
    setEditingTxn(undefined)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingTxn(undefined)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          className="mt-1 h-8 w-8 p-0"
          onClick={() => navigate({ to: '/holdings' })}
          aria-label="목록으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">
            {holding?.product_name ?? '보유종목'}
          </h1>
          {holding && (
            <p className="mt-1 text-sm text-surface-400">
              {holding.institution_name} · {holding.family_member_name}
            </p>
          )}
        </div>
        <button
          onClick={handleOpenCreate}
          className="rounded-lg bg-gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
        >
          거래 추가
        </button>
      </div>

      {/* Summary stats */}
      {holding && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg border border-white/[0.06] p-4">
          <div>
            <p className="text-xs text-surface-400">보유수량</p>
            <p className="mt-1 text-sm font-semibold text-surface-100">
              {formatNumber(holding.shares)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-400">평균단가</p>
            <p className="mt-1 text-sm font-semibold text-surface-100">
              {formatNumber(holding.avg_cost)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-400">평가금액</p>
            <p className="mt-1 text-sm font-semibold text-surface-100">
              {formatNumber(holding.market_value)}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-400">미실현 손익</p>
            <p className={`mt-1 text-sm font-semibold ${pnlColor(holding.unrealized_pnl)}`}>
              {formatNumber(holding.unrealized_pnl)} ({formatPercent(holding.unrealized_pnl_percent)})
            </p>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-surface-200">거래내역</h2>
        <div className="rounded-lg border border-white/[0.06]">
          <TransactionList
            accountId={aId}
            productId={pId}
            onEdit={handleEdit}
          />
        </div>
      </div>

      {/* Transaction form dialog */}
      <TransactionFormDialog
        open={showForm}
        onClose={handleCloseForm}
        editTransaction={editingTxn}
      />
    </div>
  )
}
