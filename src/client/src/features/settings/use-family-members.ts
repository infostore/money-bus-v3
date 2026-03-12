// PRD-FEAT-001: Family Member Management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
} from '@shared/types'

const FAMILY_MEMBERS_KEY = ['family-members'] as const

export function useFamilyMembers() {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: FAMILY_MEMBERS_KEY,
    queryFn: () => api.familyMembers.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateFamilyMemberPayload) =>
      api.familyMembers.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FAMILY_MEMBERS_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { readonly id: number; readonly input: UpdateFamilyMemberPayload }) =>
      api.familyMembers.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FAMILY_MEMBERS_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.familyMembers.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FAMILY_MEMBERS_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    members: members as readonly FamilyMember[],
    loading,
    error,
    createMember: async (input: CreateFamilyMemberPayload) => {
      await createMutation.mutateAsync(input)
    },
    updateMember: async (id: number, input: UpdateFamilyMemberPayload) => {
      await updateMutation.mutateAsync({ id, input })
    },
    deleteMember: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
  } as const
}
