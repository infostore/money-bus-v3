// PRD-FEAT-004: Product Management
import { useState, useMemo, type MutableRefObject } from 'react'
import { Package, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProductTable } from './components/ProductTable'
import { ProductFormModal } from './components/ProductFormModal'
import { ProductDeleteModal } from './components/ProductDeleteModal'
import { useProducts } from './use-products'
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
} from '@shared/types'

const ASSET_TYPE_FILTERS = [
  '전체',
  '주식',
  'ETF',
  '펀드',
  '채권',
  '예적금',
  '암호화폐',
  '기타',
] as const

interface ProductViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function ProductView({ onCreateRef }: ProductViewProps) {
  const {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useProducts()

  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('전체')

  const filteredProducts = useMemo(() => {
    if (assetTypeFilter === '전체') return products
    return products.filter((p) => p.asset_type === assetTypeFilter)
  }, [products, assetTypeFilter])

  const handleEdit = (product: Product) => {
    setEditProduct(product)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditProduct(undefined)
    setFormOpen(true)
  }

  if (onCreateRef) {
    onCreateRef.current = handleCreate
  }

  const handleFormSubmit = async (
    input: CreateProductPayload | UpdateProductPayload,
  ) => {
    if (editProduct) {
      await updateProduct(editProduct.id, input)
    } else {
      await createProduct(input as CreateProductPayload)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteProduct(deleteTarget.id)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {ASSET_TYPE_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={assetTypeFilter === filter ? 'primary' : 'ghost'}
            className="h-8 px-3 text-sm"
            onClick={() => setAssetTypeFilter(filter)}
          >
            {filter}
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
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                assetTypeFilter === '전체'
                  ? '등록된 종목이 없습니다'
                  : '해당 자산 유형의 종목이 없습니다.'
              }
              description={
                assetTypeFilter === '전체'
                  ? '종목을 추가하여 보유자산을 관리하세요.'
                  : undefined
              }
              action={
                assetTypeFilter === '전체' ? (
                  <Button onClick={handleCreate} className="gap-1.5">
                    <Plus size={16} />
                    종목 추가
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ProductTable
              products={filteredProducts}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </CardContent>
      </Card>

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        product={editProduct}
      />

      <ProductDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        product={deleteTarget}
      />
    </>
  )
}
