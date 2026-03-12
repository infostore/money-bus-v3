// PRD-FEAT-002: Institution Management
import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import type { Institution } from '@shared/types'

interface InstitutionDeleteModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onConfirm: () => Promise<void>
  readonly institution: Institution | null
}

export function InstitutionDeleteModal({
  open,
  onClose,
  onConfirm,
  institution,
}: InstitutionDeleteModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setDeleting(false)
    }
  }, [open])

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
    <Modal open={open} onClose={onClose} title="금융기관 삭제">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-surface-300">
          &apos;{institution?.name}&apos;을(를) 삭제하시겠습니까?
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
