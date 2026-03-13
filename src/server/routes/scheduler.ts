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

  // PRD-FEAT-008: Delete execution history record
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
