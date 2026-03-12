// PRD-FEAT-004: Product Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
} from '@shared/types'

const ASSET_TYPE_OPTIONS = [
  '주식',
  'ETF',
  '펀드',
  '채권',
  '예적금',
  '암호화폐',
  '기타',
] as const

interface ProductFormModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (
    input: CreateProductPayload | UpdateProductPayload,
  ) => Promise<void>
  readonly product?: Product
}

export function ProductFormModal({
  open,
  onClose,
  onSubmit,
  product,
}: ProductFormModalProps) {
  const isEdit = !!product
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [assetType, setAssetType] = useState('주식')
  const [currency, setCurrency] = useState('')
  const [exchange, setExchange] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(product?.name ?? '')
      setCode(product?.code ?? '')
      setAssetType(product?.asset_type ?? '주식')
      setCurrency(product?.currency ?? '')
      setExchange(product?.exchange ?? '')
      setError(null)
    }
  }, [open, product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('종목명을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const trimmedCode = code.trim()
      const trimmedCurrency = currency.trim()
      const trimmedExchange = exchange.trim()
      const input = {
        name: trimmedName,
        code: trimmedCode || undefined,
        asset_type: assetType,
        currency: trimmedCurrency || undefined,
        exchange: trimmedExchange || undefined,
      }
      await onSubmit(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '종목 수정' : '종목 추가'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="product-name">종목명</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="종목명 입력"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-code">종목코드</Label>
          <Input
            id="product-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="예: 005930, AAPL (선택)"
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-asset-type">자산유형</Label>
          <Select
            id="product-asset-type"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
          >
            {ASSET_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-currency">통화</Label>
          <Input
            id="product-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="KRW"
            maxLength={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-exchange">거래소</Label>
          <Input
            id="product-exchange"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            placeholder="예: KOSPI, NASDAQ (선택)"
            maxLength={20}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
