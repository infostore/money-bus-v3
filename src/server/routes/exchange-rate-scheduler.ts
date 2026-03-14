// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { Hono } from 'hono'
import type { ExchangeRateCollectorService } from '../scheduler/exchange-rate-collector-service.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { ApiResponse, TaskExecution } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

export function createExchangeRateSchedulerRoutes(
  service: ExchangeRateCollectorService,
  executionRepo: TaskExecutionRepository,
  taskId: number,
): Hono {
  const app = new Hono()

  app.post('/run', async (c) => {
    if (service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Collection already running' },
        409,
      )
    }

    const runPromise = service.run()
    runPromise.catch((err) => log('error', `Exchange rate collection run error: ${err}`))

    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection started' }, error: null },
      202,
    )
  })

  app.get('/status', async (c) => {
    const executions = await executionRepo.findRecentByTaskId(taskId, 10)
    return c.json<ApiResponse<readonly TaskExecution[]>>({
      success: true,
      data: executions,
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
