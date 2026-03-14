// PRD-FEAT-018: Scheduler Execution Detail
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution, TaskExecutionDetail } from '@shared/types'

const DETAIL_KEY_PREFIX = 'execution-details' as const

export function useExecutionDetail(executionId: number) {
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [DETAIL_KEY_PREFIX, executionId] as const,
    queryFn: () => api.scheduler.executionDetail(executionId),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    execution: (data?.execution ?? null) as TaskExecution | null,
    details: (data?.details ?? []) as readonly TaskExecutionDetail[],
    loading,
    error,
  } as const
}
