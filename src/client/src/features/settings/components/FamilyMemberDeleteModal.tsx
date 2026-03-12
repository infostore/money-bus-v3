// PRD-FEAT-001: Family Member Management
import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type { FamilyMember } from '@shared/types'

interface FamilyMemberDeleteModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onConfirm: () => Promise<void>
  readonly member: FamilyMember | null
}

export function FamilyMemberDeleteModal({
  open,
  onClose,
  onConfirm,
  member,
}: FamilyMemberDeleteModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="구성원 삭제">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-surface-300">
          &apos;{member?.name}&apos;을(를) 삭제하시겠습니까?
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            variant="error"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
