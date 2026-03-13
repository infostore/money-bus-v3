// PRD-FEAT-007: ETF Detail Page
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Product, PriceHistory } from '@shared/types'
import { rangeToFromDate, type RangeKey } from './price-history-utils'

const PRODUCT_KEY = (id: number) => ['product', id] as const
const PRICE_HISTORY_KEY = (id: number, range: RangeKey) =>
  ['price-history', id, range] as const
const SUMMARY_KEY = (id: number) => ['price-history', id, '1Y'] as const

export function useProductDetail(id: number, range: RangeKey) {
  const productQuery = useQuery({
    queryKey: PRODUCT_KEY(id),
    queryFn: () => api.products.getById(id),
    enabled: id > 0,
  })

  // Chart data — filtered by selected range
  const priceHistoryQuery = useQuery({
    queryKey: PRICE_HISTORY_KEY(id, range),
    queryFn: () => api.products.getPriceHistory(id, rangeToFromDate(range)),
    enabled: id > 0,
  })

  // Summary stats — always 1Y for accurate 52W high/low
  const summaryQuery = useQuery({
    queryKey: SUMMARY_KEY(id),
    queryFn: () => api.products.getPriceHistory(id, rangeToFromDate('1Y')),
    enabled: id > 0,
  })

  return {
    product: (productQuery.data ?? null) as Product | null,
    priceHistory: (priceHistoryQuery.data ?? []) as readonly PriceHistory[],
    summaryHistory: (summaryQuery.data ?? []) as readonly PriceHistory[],
    loading: productQuery.isLoading || priceHistoryQuery.isLoading,
    productError: productQuery.error instanceof Error ? productQuery.error.message : null,
    priceError: priceHistoryQuery.error instanceof Error ? priceHistoryQuery.error.message : null,
  } as const
}
