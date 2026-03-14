// PRD-FEAT-004: Product Management
import { useState, useMemo, useCallback, type MutableRefObject } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProductTable } from './components/ProductTable'
import { ProductFormModal } from './components/ProductFormModal'
import { ProductDeleteModal } from './components/ProductDeleteModal'
import { useProducts, useLatestPrices } from './use-products'
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
} from '@shared/types'

const ASSET_TYPE_FILTERS = [
  'ETF',
  '주식',
  '기타',
] as const

const STORAGE_KEY_ASSET_TYPE = 'product-filter-asset-type'
const STORAGE_KEY_EXCHANGE = 'product-filter-exchange'
const STORAGE_KEY_ETF_BRAND = 'product-filter-etf-brand'
const STORAGE_KEY_CURRENCY = 'product-filter-currency'

function extractEtfBrand(name: string): string {
  return name.split(' ')[0] ?? ''
}

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
  const { priceMap } = useLatestPrices()

  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_ASSET_TYPE, 'ETF'),
  )
  const [exchangeFilter, setExchangeFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_EXCHANGE, '전체'),
  )
  const [etfBrandFilter, setEtfBrandFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_ETF_BRAND, '전체'),
  )
  const [currencyFilter, setCurrencyFilter] = useState<string>(
    () => loadFilter(STORAGE_KEY_CURRENCY, '전체'),
  )

  const handleAssetTypeChange = useCallback((value: string) => {
    setAssetTypeFilter(value)
    saveFilter(STORAGE_KEY_ASSET_TYPE, value)
    if (value !== 'ETF') {
      setEtfBrandFilter('전체')
      saveFilter(STORAGE_KEY_ETF_BRAND, '전체')
    }
    if (value !== '주식') {
      setCurrencyFilter('전체')
      saveFilter(STORAGE_KEY_CURRENCY, '전체')
    }
  }, [])

  const handleExchangeChange = useCallback((value: string) => {
    setExchangeFilter(value)
    saveFilter(STORAGE_KEY_EXCHANGE, value)
  }, [])

  const handleEtfBrandChange = useCallback((value: string) => {
    setEtfBrandFilter(value)
    saveFilter(STORAGE_KEY_ETF_BRAND, value)
  }, [])

  const handleCurrencyChange = useCallback((value: string) => {
    setCurrencyFilter(value)
    saveFilter(STORAGE_KEY_CURRENCY, value)
  }, [])

  const etfBrandOptions = useMemo(() => {
    const brands = new Map<string, number>()
    for (const p of products) {
      if (p.asset_type !== 'ETF') continue
      const brand = extractEtfBrand(p.name)
      if (brand) brands.set(brand, (brands.get(brand) ?? 0) + 1)
    }
    const sorted = Array.from(brands.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
    return sorted
  }, [products])

  const currencyOptions = useMemo(() => {
    const currencies = new Set(
      products
        .filter((p) => p.asset_type === '주식')
        .map((p) => p.currency),
    )
    return ['전체', ...Array.from(currencies).sort()] as const
  }, [products])

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
      if (assetTypeFilter === '기타') {
        if (p.asset_type === 'ETF' || p.asset_type === '주식') return false
      } else if (p.asset_type !== assetTypeFilter) {
        return false
      }
      if (exchangeFilter !== '전체' && p.exchange !== exchangeFilter) return false
      if (assetTypeFilter === 'ETF') {
        if (etfBrandFilter !== '전체' && extractEtfBrand(p.name) !== etfBrandFilter) return false
      }
      if (assetTypeFilter === '주식') {
        if (currencyFilter !== '전체' && p.currency !== currencyFilter) return false
      }
      return true
    })
  }, [products, assetTypeFilter, exchangeFilter, etfBrandFilter, currencyFilter])

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
        {assetTypeFilter === '주식' && (
          <Select
            value={currencyFilter}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="h-8 w-36 py-1 text-sm"
            aria-label="통화 필터"
          >
            {currencyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === '전체' ? '전체 통화' : opt}
              </option>
            ))}
          </Select>
        )}
        {assetTypeFilter === 'ETF' && (
          <>
            <Select
              value={etfBrandFilter}
              onChange={(e) => handleEtfBrandChange(e.target.value)}
              className="h-8 w-44 py-1 text-sm"
              aria-label="운용사 필터"
            >
              <option value="전체">전체 운용사</option>
              {etfBrandOptions.map((opt) => (
                <option key={opt.name} value={opt.name}>
                  {opt.name} ({opt.count})
                </option>
              ))}
            </Select>
          </>
        )}
        {!loading && !error && (
          <span className="text-sm tabular-nums text-surface-500">
            {filteredProducts.length === products.length
              ? `${products.length}건`
              : `${filteredProducts.length} / ${products.length}건`}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="조건에 맞는 종목이 없습니다."
        />
      ) : (
        <ProductTable
          products={filteredProducts}
          priceMap={priceMap}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onDetail={(product) => navigate({ to: '/products/$id', params: { id: String(product.id) } })}
        />
      )}

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
