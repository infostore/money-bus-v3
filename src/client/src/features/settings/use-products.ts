// PRD-FEAT-004: Product Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  LatestPrice,
} from '@shared/types'

const PRODUCTS_KEY = ['products'] as const
const LATEST_PRICES_KEY = ['products', 'latest-prices'] as const

export function useProducts() {
  const queryClient = useQueryClient()

  const {
    data: products = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: () => api.products.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateProductPayload) =>
      api.products.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      readonly id: number
      readonly input: UpdateProductPayload
    }) => api.products.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.products.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    products: products as readonly Product[],
    loading,
    error,
    createProduct: async (input: CreateProductPayload) => {
      await createMutation.mutateAsync(input)
    },
    updateProduct: async (id: number, input: UpdateProductPayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteProduct: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
  } as const
}

export function useLatestPrices() {
  const {
    data: latestPrices = [],
    isLoading: loading,
  } = useQuery({
    queryKey: LATEST_PRICES_KEY,
    queryFn: () => api.products.latestPrices(),
  })

  const priceMap = new Map<number, { readonly close: string; readonly date: string }>()
  for (const p of latestPrices as readonly LatestPrice[]) {
    priceMap.set(p.product_id, { close: p.close, date: p.date })
  }

  return { priceMap, loading } as const
}
