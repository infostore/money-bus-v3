// PRD-FEAT-002: Institution Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
} from '@shared/types'

const INSTITUTIONS_KEY = ['institutions'] as const

export function useInstitutions() {
  const queryClient = useQueryClient()

  const { data: institutions = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: INSTITUTIONS_KEY,
    queryFn: () => api.institutions.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateInstitutionPayload) =>
      api.institutions.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INSTITUTIONS_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { readonly id: number; readonly input: UpdateInstitutionPayload }) =>
      api.institutions.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INSTITUTIONS_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.institutions.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INSTITUTIONS_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    institutions: institutions as readonly Institution[],
    loading,
    error,
    createInstitution: async (input: CreateInstitutionPayload) => {
      await createMutation.mutateAsync(input)
    },
    updateInstitution: async (id: number, input: UpdateInstitutionPayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteInstitution: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
  } as const
}
