// PRD-FEAT-002: Institution Management
import { useState, useMemo, type MutableRefObject } from 'react'
import { Building2, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { InstitutionTable } from './components/InstitutionTable'
import { InstitutionFormModal } from './components/InstitutionFormModal'
import { InstitutionDeleteModal } from './components/InstitutionDeleteModal'
import { useInstitutions } from './use-institutions'
import { useProducts } from './use-products'
import type {
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
} from '@shared/types'

const ETF_BRAND_TO_INSTITUTION: ReadonlyMap<string, string> = new Map([
  ['KODEX', '삼성자산운용'],
  ['TIGER', '미래에셋자산운용'],
  ['ACE', '한국투자신탁운용'],
  ['RISE', 'KB자산운용'],
  ['SOL', '신한자산운용'],
  ['HANARO', 'NH-Amundi자산운용'],
  ['KIWOOM', '키움투자자산운용'],
  ['KoAct', 'KoAct자산운용'],
  ['TIME', '타임폴리오자산운용'],
  ['PLUS', '한화자산운용'],
])

const CATEGORY_FILTERS = ['전체', '증권', '은행', '운용사'] as const

interface InstitutionViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function InstitutionView({ onCreateRef }: InstitutionViewProps) {
  const { institutions, loading, error, createInstitution, updateInstitution, deleteInstitution } =
    useInstitutions()
  const { products } = useProducts()

  const [formOpen, setFormOpen] = useState(false)
  const [editInstitution, setEditInstitution] = useState<Institution | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('운용사')

  const etfCountByInstitution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      if (p.asset_type !== 'ETF') continue
      const brand = p.name.split(' ')[0] ?? ''
      const instName = ETF_BRAND_TO_INSTITUTION.get(brand)
      if (instName) {
        counts.set(instName, (counts.get(instName) ?? 0) + 1)
      }
    }
    return counts
  }, [products])

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

  if (onCreateRef) {
    onCreateRef.current = handleCreate
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
      <div className="flex gap-2">
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
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : filteredInstitutions.length === 0 ? (
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
              etfCountMap={etfCountByInstitution}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
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
