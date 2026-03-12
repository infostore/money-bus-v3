// PRD-FEAT-001: Family Member Management
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import type {
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
} from '@shared/types'

interface UseFamilyMembersResult {
  readonly members: readonly FamilyMember[]
  readonly loading: boolean
  readonly error: string | null
  readonly refetch: () => Promise<void>
  readonly createMember: (input: CreateFamilyMemberPayload) => Promise<void>
  readonly updateMember: (
    id: number,
    input: UpdateFamilyMemberPayload,
  ) => Promise<void>
  readonly deleteMember: (id: number) => Promise<void>
}

export function useFamilyMembers(): UseFamilyMembersResult {
  const [members, setMembers] = useState<readonly FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.familyMembers.list()
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const createMember = useCallback(
    async (input: CreateFamilyMemberPayload) => {
      await api.familyMembers.create(input)
      await refetch()
    },
    [refetch],
  )

  const updateMember = useCallback(
    async (id: number, input: UpdateFamilyMemberPayload) => {
      await api.familyMembers.update(id, input)
      await refetch()
    },
    [refetch],
  )

  const deleteMember = useCallback(
    async (id: number) => {
      await api.familyMembers.delete(id)
      await refetch()
    },
    [refetch],
  )

  return {
    members,
    loading,
    error,
    refetch,
    createMember,
    updateMember,
    deleteMember,
  }
}
