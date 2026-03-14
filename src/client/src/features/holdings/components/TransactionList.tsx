// PRD-FEAT-014: Holdings Management — Inline transaction list per holding
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTransactions } from '../use-transactions'
import { Spinner } from '../../../components/ui/Spinner'
import { Button } from '../../../components/ui/Button'
import type { Transaction } from '@shared/types'

interface TransactionListProps {
  readonly accountId: number
  readonly productId: number
  readonly onEdit: (txn: Transaction) => void
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

function formatNumber(value: string): string {
  const num = parseFloat(value)
  return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

export function TransactionList({ accountId, productId, onEdit }: TransactionListProps) {
  const { transactions, loading, deleteTransaction, deleting } = useTransactions({
    account_id: accountId,
    product_id: productId,
  })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (txn: Transaction) => {
    if (!confirm(`${formatDate(txn.traded_at)} ${txn.type === 'buy' ? '매수' : '매도'} 거래를 삭제하시겠습니까?`)) {
      return
    }
    setDeletingId(txn.id)
    try {
      await deleteTransaction(txn.id)
    } catch {
      alert('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-surface-500">거래내역이 없습니다.</p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-surface-500">
          <th className="px-4 py-3 text-left font-medium">거래일</th>
          <th className="px-4 py-3 text-left font-medium">유형</th>
          <th className="px-4 py-3 text-right font-medium">수량</th>
          <th className="px-4 py-3 text-right font-medium">가격</th>
          <th className="px-4 py-3 text-right font-medium">수수료</th>
          <th className="px-4 py-3 text-right font-medium">세금</th>
          <th className="px-4 py-3 text-right font-medium">메모</th>
          <th className="px-4 py-3 text-right font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => (
          <tr
            key={txn.id}
            className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.02]"
          >
            <td className="px-4 py-3 text-surface-300">{formatDate(txn.traded_at)}</td>
            <td className="px-4 py-3">
              <span className={txn.type === 'buy' ? 'text-error-500' : 'text-blue-400'}>
                {txn.type === 'buy' ? '매수' : '매도'}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-surface-300">{formatNumber(txn.shares)}</td>
            <td className="px-4 py-3 text-right text-surface-300">{formatNumber(txn.price)}</td>
            <td className="px-4 py-3 text-right text-surface-400">{formatNumber(txn.fee)}</td>
            <td className="px-4 py-3 text-right text-surface-400">{formatNumber(txn.tax)}</td>
            <td className="max-w-[100px] truncate px-4 py-3 text-right text-surface-500">
              {txn.memo || '-'}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onEdit(txn)}
                  aria-label="수정"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0 text-error-500 hover:text-error-400"
                  onClick={() => handleDelete(txn)}
                  disabled={deleting && deletingId === txn.id}
                  aria-label="삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
