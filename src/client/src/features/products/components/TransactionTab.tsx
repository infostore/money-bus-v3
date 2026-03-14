// PRD-FEAT-014: Transaction history tab for product detail page
import { useTransactions } from '../../holdings/use-transactions'
import { Spinner } from '../../../components/ui/Spinner'
import { Clock } from 'lucide-react'

interface TransactionTabProps {
  readonly productId: number
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

function formatNumber(value: string): string {
  const num = parseFloat(value)
  return num.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

function formatAmount(shares: string, price: string): string {
  const amount = parseFloat(shares) * parseFloat(price)
  return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
}

export function TransactionTab({ productId }: TransactionTabProps) {
  const { transactions, loading } = useTransactions({ product_id: productId })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-surface-500">
        <Clock size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">거래내역이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs text-surface-500">
            <th className="px-3 py-2 text-left font-medium">거래일</th>
            <th className="px-3 py-2 text-left font-medium">유형</th>
            <th className="px-3 py-2 text-right font-medium">수량</th>
            <th className="px-3 py-2 text-right font-medium">가격</th>
            <th className="px-3 py-2 text-right font-medium">금액</th>
            <th className="px-3 py-2 text-right font-medium">수수료</th>
            <th className="px-3 py-2 text-right font-medium">세금</th>
            <th className="px-3 py-2 text-left font-medium">메모</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr
              key={txn.id}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-3 py-2 text-surface-300">{formatDate(txn.traded_at)}</td>
              <td className="px-3 py-2">
                <span className={txn.type === 'buy' ? 'text-error-500' : 'text-blue-400'}>
                  {txn.type === 'buy' ? '매수' : '매도'}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-surface-300">{formatNumber(txn.shares)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-surface-300">{formatNumber(txn.price)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-surface-200">{formatAmount(txn.shares, txn.price)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-surface-400">{formatNumber(txn.fee)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-surface-400">{formatNumber(txn.tax)}</td>
              <td className="max-w-[150px] truncate px-3 py-2 text-surface-500">
                {txn.memo || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
