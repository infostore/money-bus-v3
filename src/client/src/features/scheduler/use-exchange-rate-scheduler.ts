// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution } from '@shared/types'

const EXCHANGE_RATE_SCHEDULER_KEY = ['exchange-rate-scheduler-status'] as const

export function useExchangeRateScheduler() {
  const queryClient = useQueryClient()

  const {
    data: executions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: EXCHANGE_RATE_SCHEDULER_KEY,
    queryFn: () => api.exchangeRateScheduler.status(),
    refetchInterval: 5000,
  })

  const runMutation = useMutation({
    mutationFn: () => api.exchangeRateScheduler.run(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: EXCHANGE_RATE_SCHEDULER_KEY }),
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
    triggerRun: async () => { await runMutation.mutateAsync() },
    runError: runMutation.error instanceof Error ? runMutation.error.message : null,
  } as const
}
