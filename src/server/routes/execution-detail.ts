// PRD-FEAT-018: Scheduler Execution Detail
import { Hono } from 'hono'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { TaskExecutionDetailRepository } from '../database/task-execution-detail-repository.js'
import type { ApiResponse, TaskExecution, TaskExecutionDetail } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

interface ExecutionDetailResponse {
  readonly execution: TaskExecution
  readonly details: readonly TaskExecutionDetail[]
}

export function createExecutionDetailRoutes(
  executionRepo: TaskExecutionRepository,
  detailRepo: TaskExecutionDetailRepository,
): Hono {
  const app = new Hono()

  app.get('/:id/details', async (c) => {
    const id = Number(c.req.param('id'))
    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid execution id' },
        400,
      )
    }

    try {
      const execution = await executionRepo.findById(id)
      if (!execution) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: 'Execution not found' },
          404,
        )
      }

      const details = await detailRepo.findByExecutionId(id)
      return c.json<ApiResponse<ExecutionDetailResponse>>({
        success: true,
        data: { execution, details },
        error: null,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `Failed to fetch execution details: ${msg}`)
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '조회 중 오류가 발생했습니다' },
        500,
      )
    }
  })

  return app
}
