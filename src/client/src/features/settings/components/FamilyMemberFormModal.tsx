// PRD-FEAT-001: Family Member Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type {
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
} from '@shared/types'

const RELATIONSHIP_OPTIONS = ['본인', '배우자', '자녀', '부모', '기타'] as const

interface FamilyMemberFormModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (
    input: CreateFamilyMemberPayload | UpdateFamilyMemberPayload,
  ) => Promise<void>
  readonly member?: FamilyMember
}

export function FamilyMemberFormModal({
  open,
  onClose,
  onSubmit,
  member,
}: FamilyMemberFormModalProps) {
  const isEdit = !!member
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('본인')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(member?.name ?? '')
      setRelationship(member?.relationship ?? '본인')
      setBirthYear(member?.birth_year?.toString() ?? '')
      setError(null)
    }
  }, [open, member])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('이름을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const input = {
        name: trimmedName,
        relationship,
        birth_year: birthYear ? Number(birthYear) : undefined,
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
      title={isEdit ? '구성원 수정' : '구성원 추가'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            maxLength={50}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="relationship">관계</Label>
          <Select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthYear">출생연도</Label>
          <Input
            id="birthYear"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="YYYY"
            min={1900}
            max={new Date().getFullYear()}
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
