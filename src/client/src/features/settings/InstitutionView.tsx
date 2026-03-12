// PRD-FEAT-002: Institution Management
import { useState, useMemo } from 'react'
import { Building2, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { InstitutionTable } from './components/InstitutionTable'
import { InstitutionFormModal } from './components/InstitutionFormModal'
import { InstitutionDeleteModal } from './components/InstitutionDeleteModal'
import { useInstitutions } from './use-institutions'
import type {
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
} from '@shared/types'

const CATEGORY_FILTERS = ['전체', '증권', '은행', '운용사'] as const

export function InstitutionView() {
  const { institutions, loading, error, createInstitution, updateInstitution, deleteInstitution } =
    useInstitutions()

  const [formOpen, setFormOpen] = useState(false)
  const [editInstitution, setEditInstitution] = useState<Institution | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('전체')

  const filteredInstitutions = useMemo(() => {
    if (categoryFilter === '전체') return institutions
    return institutions.filter((inst) => inst.category === categoryFilter)
  }, [institutions, categoryFilter])

  const handleEdit = (institution: Institution) => {
    setEditInstitution(institution)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditInstitution(undefined)
    setFormOpen(true)
  }

  const handleFormSubmit = async (
    input: CreateInstitutionPayload | UpdateInstitutionPayload,
  ) => {
    if (editInstitution) {
      await updateInstitution(editInstitution.id, input)
    } else {
      await createInstitution(input as CreateInstitutionPayload)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteInstitution(deleteTarget.id)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">금융기관</CardTitle>
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus size={16} />
              추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                {CATEGORY_FILTERS.map((cat) => (
                  <Button
                    key={cat}
                    variant={categoryFilter === cat ? 'primary' : 'ghost'}
                    className="h-8 px-3 text-sm"
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              {filteredInstitutions.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="등록된 금융기관이 없습니다"
                  description="금융기관을 추가하여 계좌와 상품을 관리하세요."
                  action={
                    categoryFilter === '전체' ? (
                      <Button onClick={handleCreate} className="gap-1.5">
                        <Plus size={16} />
                        금융기관 추가
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <InstitutionTable
                  institutions={filteredInstitutions}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <InstitutionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        institution={editInstitution}
      />

      <InstitutionDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        institution={deleteTarget}
      />
    </>
  )
}
