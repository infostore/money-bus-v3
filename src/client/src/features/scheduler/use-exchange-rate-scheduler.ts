// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { TaskExecution } from '@shared/types'

const EXCHANGE_RATE_SCHEDULER_KEY = ['exchange-rate-scheduler-status'] as const

export function useExchangeRateScheduler() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.exchangeRateScheduler.deleteExecution(id),
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
    deleteExecution: async (id: number) => {
      setDeletingId(id)
      try { await deleteMutation.mutateAsync(id) } finally { setDeletingId(null) }
    },
    deletingId,
    deleteError: deleteMutation.error instanceof Error ? deleteMutation.error.message : null,
  } as const
}
