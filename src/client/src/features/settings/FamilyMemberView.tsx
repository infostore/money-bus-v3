// PRD-FEAT-001: Family Member Management
import { useState, type MutableRefObject } from 'react'
import { Users, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { FamilyMemberTable } from './components/FamilyMemberTable'
import { FamilyMemberFormModal } from './components/FamilyMemberFormModal'
import { FamilyMemberDeleteModal } from './components/FamilyMemberDeleteModal'
import { useFamilyMembers } from './use-family-members'
import type {
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
} from '@shared/types'

interface FamilyMemberViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function FamilyMemberView({ onCreateRef }: FamilyMemberViewProps) {
  const { members, loading, error, createMember, updateMember, deleteMember } =
    useFamilyMembers()

  const [formOpen, setFormOpen] = useState(false)
  const [editMember, setEditMember] = useState<FamilyMember | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null)

  const handleEdit = (member: FamilyMember) => {
    setEditMember(member)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditMember(undefined)
    setFormOpen(true)
  }

  if (onCreateRef) {
    onCreateRef.current = handleCreate
  }

  const handleFormSubmit = async (
    input: CreateFamilyMemberPayload | UpdateFamilyMemberPayload,
  ) => {
    if (editMember) {
      await updateMember(editMember.id, input)
    } else {
      await createMember(input as CreateFamilyMemberPayload)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteMember(deleteTarget.id)
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="등록된 구성원이 없습니다"
              description="가족 구성원을 추가하여 자산을 관리하세요."
              action={
                <Button onClick={handleCreate} className="gap-1.5">
                  <Plus size={16} />
                  구성원 추가
                </Button>
              }
            />
          ) : (
            <FamilyMemberTable
              members={members}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <FamilyMemberFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        member={editMember}
      />

      <FamilyMemberDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        member={deleteTarget}
      />
    </>
  )
}
