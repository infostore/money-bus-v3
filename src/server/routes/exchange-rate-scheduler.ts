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

  return app
}
