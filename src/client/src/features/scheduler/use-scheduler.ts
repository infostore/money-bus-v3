// PRD-FEAT-005: Price Scheduler
// PRD-FEAT-008: Scheduler Execution History Delete
// PRD-FEAT-009: Scheduler Execution Stop
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

  const stopMutation = useMutation({
    mutationFn: () => api.scheduler.stop(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SCHEDULER_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.scheduler.deleteExecution(id),
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
    stopRun: async () => {
      await stopMutation.mutateAsync()
    },
    isStopping: stopMutation.isPending,
    stopError: stopMutation.error instanceof Error ? stopMutation.error.message : null,
    deleteExecution: async (id: number) => {
      await deleteMutation.mutateAsync(id)
    },
    deletingId: deleteMutation.isPending ? (deleteMutation.variables as number | undefined) ?? null : null,
    deleteError: deleteMutation.error instanceof Error ? deleteMutation.error.message : null,
  } as const
}
