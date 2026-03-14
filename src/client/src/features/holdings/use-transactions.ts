// PRD-FEAT-014: Holdings Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
} from '@shared/types'

const TRANSACTIONS_KEY = ['transactions'] as const
const HOLDINGS_KEY = ['holdings'] as const

export function useTransactions(filter?: {
  readonly account_id?: number
  readonly product_id?: number
}) {
  const queryClient = useQueryClient()

  const queryKey = filter
    ? [...TRANSACTIONS_KEY, filter] as const
    : TRANSACTIONS_KEY

  const {
    data: transactions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => api.transactions.list(filter),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateTransactionPayload) =>
      api.transactions.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      readonly id: number
      readonly input: UpdateTransactionPayload
    }) => api.transactions.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY })
    },
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    transactions: transactions as readonly Transaction[],
    loading,
    error,
    createTransaction: async (input: CreateTransactionPayload) => {
      await createMutation.mutateAsync(input)
    },
    updateTransaction: async (id: number, input: UpdateTransactionPayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteTransaction: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  } as const
}
