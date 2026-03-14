// PRD-FEAT-017: Holdings Price Collection Scheduler
import { Hono } from 'hono'
import { type HoldingsPriceCollectorService, PERIOD_LOOKBACK_MAP } from '../scheduler/holdings-price-collector-service.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { ApiResponse, TaskExecution } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

export function createHoldingsPriceSchedulerRoutes(
  service: HoldingsPriceCollectorService,
  executionRepo: TaskExecutionRepository,
  domesticTaskId: number,
  foreignTaskId: number,
): Hono {
  const app = new Hono()

  app.post('/run', async (c) => {
    if (service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Collection already running' },
        409,
      )
    }

    const body = await c.req.json<{ period?: string }>().catch(() => ({}))
    const lookbackDays = body.period ? PERIOD_LOOKBACK_MAP[body.period] ?? 3 : 3
    const runPromise = service.run('all', lookbackDays)
    runPromise.catch((err) => log('error', `Holdings price collection run error: ${err}`))

    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection started' }, error: null },
      202,
    )
  })

  app.get('/status', async (c) => {
    const [domestic, foreign] = await Promise.all([
      executionRepo.findRecentByTaskId(domesticTaskId, 10),
      executionRepo.findRecentByTaskId(foreignTaskId, 10),
    ])
    const combined = [...domestic, ...foreign]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10)
    return c.json<ApiResponse<readonly TaskExecution[]>>({
      success: true,
      data: combined,
      error: null,
    })
  })

  app.delete('/executions/:id', async (c) => {
    const id = Number(c.req.param('id'))
    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid execution id' },
        400,
      )
    }

    const execution = await executionRepo.findById(id)
    if (!execution) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Execution not found' },
        404,
      )
    }
    if (execution.status === 'running') {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Cannot delete a running execution' },
        409,
      )
    }

    await executionRepo.delete(id)
    return c.json<ApiResponse<null>>({ success: true, data: null, error: null })
  })

  return app
}
