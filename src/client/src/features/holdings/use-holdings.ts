// PRD-FEAT-014: Holdings Management
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { HoldingWithDetails, RealizedPnlEntry } from '@shared/types'

const HOLDINGS_KEY = ['holdings'] as const
const REALIZED_PNL_KEY = ['holdings', 'realized-pnl'] as const

export function useHoldings(filter?: {
  readonly account_id?: number
  readonly family_member_id?: number
}) {
  const queryKey = filter
    ? [...HOLDINGS_KEY, filter] as const
    : HOLDINGS_KEY

  const {
    data: holdings = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => api.holdings.list(filter),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    holdings: holdings as readonly HoldingWithDetails[],
    loading,
    error,
  } as const
}

export function useRealizedPnl(filter?: {
  readonly account_id?: number
  readonly family_member_id?: number
  readonly from?: string
  readonly to?: string
}) {
  const queryKey = filter
    ? [...REALIZED_PNL_KEY, filter] as const
    : REALIZED_PNL_KEY

  const {
    data: entries = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => api.holdings.realizedPnl(filter),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    entries: entries as readonly RealizedPnlEntry[],
    loading,
    error,
  } as const
}
