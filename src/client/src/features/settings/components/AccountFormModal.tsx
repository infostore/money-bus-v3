// PRD-FEAT-010: Account Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import { useFamilyMembers } from '../use-family-members'
import { useInstitutions } from '../use-institutions'
import { useAccountTypes } from '../use-account-types'
import type {
  AccountWithDetails,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@shared/types'

interface AccountFormModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (
    input: CreateAccountPayload | UpdateAccountPayload,
  ) => Promise<void>
  readonly account?: AccountWithDetails
}

export function AccountFormModal({
  open,
  onClose,
  onSubmit,
  account,
}: AccountFormModalProps) {
  const isEdit = !!account
  const { members: familyMembers } = useFamilyMembers()
  const { institutions } = useInstitutions()
  const { accountTypes } = useAccountTypes()

  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [familyMemberId, setFamilyMemberId] = useState<number>(0)
  const [institutionId, setInstitutionId] = useState<number>(0)
  const [accountTypeId, setAccountTypeId] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAccountName(account?.account_name ?? '')
      setAccountNumber(account?.account_number ?? '')
      setFamilyMemberId(account?.family_member_id ?? (familyMembers[0]?.id ?? 0))
      setInstitutionId(account?.institution_id ?? (institutions[0]?.id ?? 0))
      setAccountTypeId(account?.account_type_id ?? (accountTypes[0]?.id ?? 0))
      setError(null)
    }
  }, [open, account, familyMembers, institutions, accountTypes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = accountName.trim()
    if (!trimmedName) {
      setError('계좌명을 입력해주세요.')
      return
    }
    if (!familyMemberId) {
      setError('구성원을 선택해주세요.')
      return
    }
    if (!institutionId) {
      setError('금융기관을 선택해주세요.')
      return
    }
    if (!accountTypeId) {
      setError('계좌유형을 선택해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const trimmedNumber = accountNumber.trim()
      const input: CreateAccountPayload = {
        account_name: trimmedName,
        account_number: trimmedNumber || undefined,
        family_member_id: familyMemberId,
        institution_id: institutionId,
        account_type_id: accountTypeId,
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
      title={isEdit ? '계좌 수정' : '계좌 추가'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="account-name">계좌명</Label>
          <Input
            id="account-name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="예: 삼성증권 ISA"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-number">계좌번호</Label>
          <Input
            id="account-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="선택 입력"
            maxLength={30}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-member">소유자</Label>
          <Select
            id="account-member"
            value={familyMemberId}
            onChange={(e) => setFamilyMemberId(Number(e.target.value))}
          >
            {familyMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.relationship})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-institution">금융기관</Label>
          <Select
            id="account-institution"
            value={institutionId}
            onChange={(e) => setInstitutionId(Number(e.target.value))}
          >
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type">계좌유형</Label>
          <Select
            id="account-type"
            value={accountTypeId}
            onChange={(e) => setAccountTypeId(Number(e.target.value))}
          >
            {accountTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
