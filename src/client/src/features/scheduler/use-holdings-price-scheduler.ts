// PRD-FEAT-017: Holdings Price Collection Scheduler
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution } from '@shared/types'

const HOLDINGS_PRICE_SCHEDULER_KEY = ['holdings-price-scheduler-status'] as const

export function useHoldingsPriceScheduler() {
  const queryClient = useQueryClient()

  const {
    data: executions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: HOLDINGS_PRICE_SCHEDULER_KEY,
    queryFn: () => api.holdingsPriceScheduler.status(),
    refetchInterval: 5000,
  })

  const runMutation = useMutation({
    mutationFn: (period?: string) => api.holdingsPriceScheduler.run(period),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: HOLDINGS_PRICE_SCHEDULER_KEY }),
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
    triggerRun: async (period?: string) => { await runMutation.mutateAsync(period) },
    runError: runMutation.error instanceof Error ? runMutation.error.message : null,
  } as const
}
