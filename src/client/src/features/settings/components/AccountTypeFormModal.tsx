// PRD-FEAT-003: Account Type Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type {
  AccountType,
  CreateAccountTypePayload,
  UpdateAccountTypePayload,
} from '@shared/types'

const TAX_TREATMENT_OPTIONS = ['세금우대', '일반', '연금'] as const

interface AccountTypeFormModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (
    input: CreateAccountTypePayload | UpdateAccountTypePayload,
  ) => Promise<void>
  readonly accountType?: AccountType
}

export function AccountTypeFormModal({
  open,
  onClose,
  onSubmit,
  accountType,
}: AccountTypeFormModalProps) {
  const isEdit = !!accountType
  const [name, setName] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [taxTreatment, setTaxTreatment] = useState('일반')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(accountType?.name ?? '')
      setShortCode(accountType?.short_code ?? '')
      setTaxTreatment(accountType?.tax_treatment ?? '일반')
      setError(null)
    }
  }, [open, accountType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('계좌유형명을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const trimmedCode = shortCode.trim()
      const input = {
        name: trimmedName,
        short_code: trimmedCode || undefined,
        tax_treatment: taxTreatment,
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
      title={isEdit ? '계좌유형 수정' : '계좌유형 추가'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="account-type-name">계좌유형명</Label>
          <Input
            id="account-type-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="계좌유형명 입력"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type-short-code">단축코드</Label>
          <Input
            id="account-type-short-code"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            placeholder="예: ISA, IRP, DC (선택)"
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type-tax-treatment">세금처리</Label>
          <Select
            id="account-type-tax-treatment"
            value={taxTreatment}
            onChange={(e) => setTaxTreatment(e.target.value)}
          >
            {TAX_TREATMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
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
