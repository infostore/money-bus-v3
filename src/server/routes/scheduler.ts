// PRD-FEAT-005: Price History Scheduler
import { Hono } from 'hono'
import type { PriceCollectorService } from '../scheduler/price-collector-service.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { ApiResponse, TaskExecution } from '../../shared/types.js'

export function createSchedulerRoutes(
  service: PriceCollectorService,
  executionRepo: TaskExecutionRepository,
  taskId: number,
): Hono {
  const app = new Hono()

  app.post('/run', async (c) => {
    if (service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Collection is already running' },
        409,
      )
    }

    const executionPromise = service.run()
    executionPromise.catch(() => {
      /* errors handled inside service */
    })

    return c.json(
      { success: true, data: { run_id: 0 }, error: null },
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
