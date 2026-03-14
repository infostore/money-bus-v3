// PRD-FEAT-014: Holdings Management
import { useState, useEffect, useMemo } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import { Autocomplete } from '../../../components/ui/Autocomplete'
import type { AutocompleteOption } from '../../../components/ui/Autocomplete'
import { useTransactions } from '../use-transactions'
import { useAccounts } from '../../settings/use-accounts'
import { useProducts } from '../../settings/use-products'
import type { Transaction, UpdateTransactionPayload } from '@shared/types'

interface TransactionFormDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly editTransaction?: Transaction
}

interface FormState {
  readonly account_id: string
  readonly product_id: string
  readonly type: 'buy' | 'sell'
  readonly shares: string
  readonly price: string
  readonly fee: string
  readonly tax: string
  readonly traded_at: string
  readonly memo: string
}

const INITIAL_FORM: FormState = {
  account_id: '',
  product_id: '',
  type: 'buy',
  shares: '',
  price: '',
  fee: '0',
  tax: '0',
  traded_at: new Date().toISOString().slice(0, 10),
  memo: '',
}

export function TransactionFormDialog({
  open,
  onClose,
  editTransaction,
}: TransactionFormDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const [showDateWarning, setShowDateWarning] = useState(false)

  const { createTransaction, updateTransaction, creating, updating } = useTransactions()
  const { accounts } = useAccounts()
  const { products } = useProducts()

  const isEdit = editTransaction !== undefined

  const productOptions: readonly AutocompleteOption[] = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: p.name,
        sub: [p.code, p.asset_type].filter(Boolean).join(' · ') || undefined,
      })),
    [products],
  )

  useEffect(() => {
    if (editTransaction) {
      setForm({
        account_id: String(editTransaction.account_id),
        product_id: String(editTransaction.product_id),
        type: editTransaction.type,
        shares: editTransaction.shares,
        price: editTransaction.price,
        fee: editTransaction.fee,
        tax: editTransaction.tax,
        traded_at: editTransaction.traded_at,
        memo: editTransaction.memo,
      })
    } else {
      setForm(INITIAL_FORM)
    }
    setError(null)
    setShowDateWarning(false)
  }, [editTransaction, open])

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))

    // Show date change warning when editing
    if (field === 'traded_at' && isEdit && value !== editTransaction?.traded_at) {
      setShowDateWarning(true)
    }
  }

  const handleSubmit = async () => {
    setError(null)

    const accountId = parseInt(form.account_id, 10)
    const productId = parseInt(form.product_id, 10)
    const shares = parseFloat(form.shares)
    const price = parseFloat(form.price)
    const fee = parseFloat(form.fee || '0')
    const tax = parseFloat(form.tax || '0')

    if (!accountId || !productId) {
      setError('계좌와 종목을 선택해주세요.')
      return
    }
    if (isNaN(shares) || shares <= 0) {
      setError('수량은 0보다 커야 합니다.')
      return
    }
    if (isNaN(price) || price <= 0) {
      setError('가격은 0보다 커야 합니다.')
      return
    }

    try {
      if (isEdit) {
        const payload: UpdateTransactionPayload = {
          type: form.type,
          shares,
          price,
          fee,
          tax,
          traded_at: form.traded_at,
          memo: form.memo,
        }
        await updateTransaction(editTransaction!.id, payload)
      } else {
        await createTransaction({
          account_id: accountId,
          product_id: productId,
          type: form.type,
          shares,
          price,
          fee,
          tax,
          traded_at: form.traded_at,
          memo: form.memo,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const pending = creating || updating

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '거래 수정' : '거래 추가'}
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {showDateWarning && (
          <Alert variant="warning">거래일 변경 시 전체 거래내역이 재계산됩니다.</Alert>
        )}

        {/* Type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleChange('type', 'buy')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              form.type === 'buy'
                ? 'bg-success-500/15 text-success-500'
                : 'bg-surface-800/50 text-surface-400'
            }`}
          >
            매수
          </button>
          <button
            type="button"
            onClick={() => handleChange('type', 'sell')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              form.type === 'sell'
                ? 'bg-error-500/15 text-error-500'
                : 'bg-surface-800/50 text-surface-400'
            }`}
          >
            매도
          </button>
        </div>

        {/* Account and Product — disabled on edit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>계좌</Label>
            <Select
              value={form.account_id}
              onChange={(e) => handleChange('account_id', e.target.value)}
              disabled={isEdit}
            >
              <option value="">선택</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>종목</Label>
            {isEdit ? (
              <Input
                value={products.find((p) => p.id === Number(form.product_id))?.name ?? ''}
                disabled
              />
            ) : (
              <Autocomplete
                options={productOptions}
                value={form.product_id}
                onChange={(v) => handleChange('product_id', v)}
                placeholder="종목 검색"
              />
            )}
          </div>
        </div>

        {/* Shares and Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>수량</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={form.shares}
              onChange={(e) => handleChange('shares', e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>가격</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={form.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Fee and Tax */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>수수료</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={form.fee}
              onChange={(e) => handleChange('fee', e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>세금</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={form.tax}
              onChange={(e) => handleChange('tax', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Date and Memo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>거래일</Label>
            <Input
              type="date"
              value={form.traded_at}
              onChange={(e) => handleChange('traded_at', e.target.value)}
            />
          </div>
          <div>
            <Label>메모</Label>
            <Input
              type="text"
              value={form.memo}
              onChange={(e) => handleChange('memo', e.target.value)}
              placeholder="선택사항"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={pending}>
            {pending ? '처리 중...' : isEdit ? '수정' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
