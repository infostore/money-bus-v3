// PRD-FEAT-010: Account Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  AccountWithDetails,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@shared/types'

const ACCOUNTS_KEY = ['accounts'] as const

export function useAccounts() {
  const queryClient = useQueryClient()

  const {
    data: accounts = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => api.accounts.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateAccountPayload) =>
      api.accounts.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      readonly id: number
      readonly input: UpdateAccountPayload
    }) => api.accounts.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.accounts.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    accounts: accounts as readonly AccountWithDetails[],
    loading,
    error,
    createAccount: async (input: CreateAccountPayload) => {
      await createMutation.mutateAsync(input)
    },
    updateAccount: async (id: number, input: UpdateAccountPayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteAccount: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
  } as const
}
