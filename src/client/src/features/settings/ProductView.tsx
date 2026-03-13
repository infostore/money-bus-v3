// PRD-FEAT-004: Product Management
import { useState, useMemo, useCallback, type MutableRefObject } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Package, Plus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
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

const STORAGE_KEY_ASSET_TYPE = 'product-filter-asset-type'
const STORAGE_KEY_EXCHANGE = 'product-filter-exchange'

function loadFilter(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function saveFilter(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full or unavailable — ignore
  }
}

interface ProductViewProps {
  readonly onCreateRef?: MutableRefObject<(() => void) | undefined>
}

export function ProductView({ onCreateRef }: ProductViewProps) {
  const navigate = useNavigate()
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
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_ASSET_TYPE, '전체'),
  )
  const [exchangeFilter, setExchangeFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_EXCHANGE, '전체'),
  )

  const handleAssetTypeChange = useCallback((value: string) => {
    setAssetTypeFilter(value)
    saveFilter(STORAGE_KEY_ASSET_TYPE, value)
  }, [])

  const handleExchangeChange = useCallback((value: string) => {
    setExchangeFilter(value)
    saveFilter(STORAGE_KEY_EXCHANGE, value)
  }, [])

  const exchangeOptions = useMemo(() => {
    const exchanges = new Set(
      products
        .map((p) => p.exchange)
        .filter((e): e is string => e !== null && e !== ''),
    )
    return ['전체', ...Array.from(exchanges).sort()] as const
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (assetTypeFilter !== '전체' && p.asset_type !== assetTypeFilter) return false
      if (exchangeFilter !== '전체' && p.exchange !== exchangeFilter) return false
      return true
    })
  }, [products, assetTypeFilter, exchangeFilter])

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
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {ASSET_TYPE_FILTERS.map((filter) => (
            <Button
              key={filter}
              variant={assetTypeFilter === filter ? 'primary' : 'ghost'}
              className="h-8 px-3 text-sm"
              onClick={() => handleAssetTypeChange(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
        <Select
          value={exchangeFilter}
          onChange={(e) => handleExchangeChange(e.target.value)}
          className="h-8 w-36 py-1 text-sm"
          aria-label="시장 필터"
        >
          {exchangeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === '전체' ? '전체 시장' : opt}
            </option>
          ))}
        </Select>
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
                assetTypeFilter === '전체' && exchangeFilter === '전체'
                  ? '등록된 종목이 없습니다'
                  : '조건에 맞는 종목이 없습니다.'
              }
              description={
                assetTypeFilter === '전체' && exchangeFilter === '전체'
                  ? '종목을 추가하여 보유자산을 관리하세요.'
                  : undefined
              }
              action={
                assetTypeFilter === '전체' && exchangeFilter === '전체' ? (
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
              onDetail={(product) => navigate({ to: '/products/$id', params: { id: String(product.id) } })}
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
