// PRD-FEAT-013: ETF Component UI
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution } from '@shared/types'

const ETF_SCHEDULER_KEY = ['etf-scheduler-status'] as const

export function useEtfScheduler() {
  const queryClient = useQueryClient()

  const {
    data: executions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ETF_SCHEDULER_KEY,
    queryFn: () => api.etfScheduler.status(),
    refetchInterval: 5000,
  })

  const runMutation = useMutation({
    mutationFn: () => api.etfScheduler.run(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ETF_SCHEDULER_KEY }),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.etfScheduler.stop(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ETF_SCHEDULER_KEY }),
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
  } as const
}
