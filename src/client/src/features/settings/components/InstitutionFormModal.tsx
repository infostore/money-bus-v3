// PRD-FEAT-002: Institution Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Label } from '../../../components/ui/Label'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type {
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
} from '@shared/types'

const CATEGORY_OPTIONS = ['증권', '은행', '운용사'] as const

interface InstitutionFormModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (
    input: CreateInstitutionPayload | UpdateInstitutionPayload,
  ) => Promise<void>
  readonly institution?: Institution
}

export function InstitutionFormModal({
  open,
  onClose,
  onSubmit,
  institution,
}: InstitutionFormModalProps) {
  const isEdit = !!institution
  const [name, setName] = useState('')
  const [category, setCategory] = useState('증권')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(institution?.name ?? '')
      setCategory(institution?.category ?? '증권')
      setError(null)
    }
  }, [open, institution])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('기관명을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const input = {
        name: trimmedName,
        category,
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
      title={isEdit ? '금융기관 수정' : '금융기관 추가'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="institution-name">기관명</Label>
          <Input
            id="institution-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="기관명 입력"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution-category">카테고리</Label>
          <Select
            id="institution-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
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
