// PRD-FEAT-005: Price Scheduler
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution } from '@shared/types'

const SCHEDULER_KEY = ['scheduler-status'] as const

export function useScheduler() {
  const queryClient = useQueryClient()

  const {
    data: executions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: SCHEDULER_KEY,
    queryFn: () => api.scheduler.status(),
    refetchInterval: 5000,
  })

  const runMutation = useMutation({
    mutationFn: () => api.scheduler.run(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SCHEDULER_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  const isRunning = executions.some(
    (e: TaskExecution) => e.status === 'running',
  )

  return {
    executions: executions as readonly TaskExecution[],
    loading,
    error,
    isRunning,
    triggerRun: async () => {
      await runMutation.mutateAsync()
    },
    runError: runMutation.error instanceof Error ? runMutation.error.message : null,
  } as const
}
