// PRD-FEAT-008: Scheduler Execution History Delete - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { ScheduledTaskRepository } from '../../src/server/database/scheduled-task-repository.js'
import { TaskExecutionRepository } from '../../src/server/database/task-execution-repository.js'
import { createSchedulerRoutes } from '../../src/server/routes/scheduler.js'
import { TEST_DATABASE_URL } from './test-database.js'
import type { PriceCollectorService } from '../../src/server/scheduler/price-collector-service.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono
let taskRepo: ScheduledTaskRepository
let execRepo: TaskExecutionRepository
let taskId: number

const mockService = { running: false, run: async () => ({}) } as unknown as PriceCollectorService

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  taskRepo = new ScheduledTaskRepository(db)
  execRepo = new TaskExecutionRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE task_executions, scheduled_tasks RESTART IDENTITY CASCADE`,
  )
  const task = await taskRepo.seedDefault({
    name: 'price-fetch',
    cronExpression: '0 18 * * 1-5',
    enabled: true,
  })
  taskId = task.id
  app = new Hono()
  app.route('/api/scheduler/price-collection', createSchedulerRoutes(mockService, execRepo, taskId))
})

async function request(
  method: string,
  path: string,
): Promise<Response> {
  return app.request(path, { method })
}

describe('DELETE /api/scheduler/price-collection/executions/:id', () => {
  it('returns 200 and deletes a completed execution', async () => {
    const exec = await execRepo.create({ taskId, startedAt: new Date() })
    await execRepo.complete(exec.id, {
      status: 'success',
      productsTotal: 5,
      productsSucceeded: 5,
      productsFailed: 0,
      productsSkipped: 0,
      message: null,
    })

    const res = await request('DELETE', `/api/scheduler/price-collection/executions/${exec.id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()

    // Verify deleted
    const found = await execRepo.findById(exec.id)
    expect(found).toBeUndefined()
  })

  it('returns 200 for failed execution', async () => {
    const exec = await execRepo.create({ taskId, startedAt: new Date() })
    await execRepo.complete(exec.id, {
      status: 'failed',
      productsTotal: 0,
      productsSucceeded: 0,
      productsFailed: 0,
      productsSkipped: 0,
      message: 'Error occurred',
    })

    const res = await request('DELETE', `/api/scheduler/price-collection/executions/${exec.id}`)
    expect(res.status).toBe(200)
  })

  it('returns 409 for running execution', async () => {
    const exec = await execRepo.create({ taskId, startedAt: new Date() })

    const res = await request('DELETE', `/api/scheduler/price-collection/executions/${exec.id}`)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Cannot delete a running execution')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/scheduler/price-collection/executions/999')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Execution not found')
  })

  it('returns 400 for non-numeric id', async () => {
    const res = await request('DELETE', '/api/scheduler/price-collection/executions/abc')
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Invalid execution id')
  })
})
