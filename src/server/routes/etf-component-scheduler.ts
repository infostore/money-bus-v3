// PRD-FEAT-012: ETF Component Collection Scheduler
import { Hono } from 'hono'
import type { EtfComponentCollectorService } from '../scheduler/etf-component-collector-service.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { ApiResponse, TaskExecution } from '../../shared/types.js'

export function createEtfSchedulerRoutes(
  service: EtfComponentCollectorService,
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
    runPromise.catch(() => { /* errors handled inside service */ })

    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection started' }, error: null },
      202,
    )
  })

  app.post('/stop', async (c) => {
    if (!service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'No collection is currently running' },
        409,
      )
    }

    service.abort()
    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection stopping' }, error: null },
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
