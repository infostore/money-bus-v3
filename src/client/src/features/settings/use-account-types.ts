// PRD-FEAT-003: Account Type Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  AccountType,
  CreateAccountTypePayload,
  UpdateAccountTypePayload,
} from '@shared/types'

const ACCOUNT_TYPES_KEY = ['account-types'] as const

export function useAccountTypes() {
  const queryClient = useQueryClient()

  const {
    data: accountTypes = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ACCOUNT_TYPES_KEY,
    queryFn: () => api.accountTypes.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateAccountTypePayload) =>
      api.accountTypes.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNT_TYPES_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      readonly id: number
      readonly input: UpdateAccountTypePayload
    }) => api.accountTypes.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNT_TYPES_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.accountTypes.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ACCOUNT_TYPES_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    accountTypes: accountTypes as readonly AccountType[],
    loading,
    error,
    createAccountType: async (input: CreateAccountTypePayload) => {
      await createMutation.mutateAsync(input)
    },
    updateAccountType: async (id: number, input: UpdateAccountTypePayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteAccountType: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
  } as const
}
