// PRD-FEAT-005: Price History Scheduler - TaskExecution Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ScheduledTaskRepository } from '../../src/server/database/scheduled-task-repository.js'
import { TaskExecutionRepository } from '../../src/server/database/task-execution-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let taskRepo: ScheduledTaskRepository
let execRepo: TaskExecutionRepository

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
})

describe('TaskExecutionRepository.create', () => {
  it('inserts a running execution', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    const startedAt = new Date('2026-03-13T18:00:00Z')
    const exec = await execRepo.create({ taskId: task.id, startedAt })

    expect(exec.id).toBeGreaterThan(0)
    expect(exec.task_id).toBe(task.id)
    expect(exec.started_at).toBe(startedAt.toISOString())
    expect(exec.finished_at).toBeNull()
    expect(exec.status).toBe('running')
    expect(exec.products_total).toBe(0)
    expect(exec.products_succeeded).toBe(0)
    expect(exec.products_failed).toBe(0)
    expect(exec.products_skipped).toBe(0)
    expect(exec.message).toBeNull()
    expect(exec.created_at).toBeDefined()
  })
})

describe('TaskExecutionRepository.complete', () => {
  it('updates status, sets finishedAt, and result fields', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })
    const exec = await execRepo.create({ taskId: task.id, startedAt: new Date() })

    const completed = await execRepo.complete(exec.id, {
      status: 'success',
      productsTotal: 10,
      productsSucceeded: 8,
      productsFailed: 1,
      productsSkipped: 1,
      message: 'Completed with minor issues',
    })

    expect(completed).toBeDefined()
    expect(completed!.status).toBe('success')
    expect(completed!.finished_at).not.toBeNull()
    expect(completed!.products_total).toBe(10)
    expect(completed!.products_succeeded).toBe(8)
    expect(completed!.products_failed).toBe(1)
    expect(completed!.products_skipped).toBe(1)
    expect(completed!.message).toBe('Completed with minor issues')
  })

  it('returns undefined for non-existent id', async () => {
    const result = await execRepo.complete(999, {
      status: 'success',
      productsTotal: 0,
      productsSucceeded: 0,
      productsFailed: 0,
      productsSkipped: 0,
      message: null,
    })

    expect(result).toBeUndefined()
  })
})

describe('TaskExecutionRepository.findRecentByTaskId', () => {
  it('returns executions sorted by started_at DESC', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    await execRepo.create({ taskId: task.id, startedAt: new Date('2026-03-10T18:00:00Z') })
    await execRepo.create({ taskId: task.id, startedAt: new Date('2026-03-12T18:00:00Z') })
    await execRepo.create({ taskId: task.id, startedAt: new Date('2026-03-11T18:00:00Z') })

    const result = await execRepo.findRecentByTaskId(task.id)
    expect(result).toHaveLength(3)
    expect(result[0].started_at).toBe('2026-03-12T18:00:00.000Z')
    expect(result[1].started_at).toBe('2026-03-11T18:00:00.000Z')
    expect(result[2].started_at).toBe('2026-03-10T18:00:00.000Z')
  })

  it('respects limit', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    for (let i = 0; i < 5; i++) {
      await execRepo.create({
        taskId: task.id,
        startedAt: new Date(`2026-03-${10 + i}T18:00:00Z`),
      })
    }

    const result = await execRepo.findRecentByTaskId(task.id, 3)
    expect(result).toHaveLength(3)
    expect(result[0].started_at).toBe('2026-03-14T18:00:00.000Z')
  })
})

describe('TaskExecutionRepository.trimOldExecutions', () => {
  it('keeps only the most recent N executions', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    for (let i = 0; i < 5; i++) {
      await execRepo.create({
        taskId: task.id,
        startedAt: new Date(`2026-03-${10 + i}T18:00:00Z`),
      })
    }

    const deleted = await execRepo.trimOldExecutions(task.id, 3)
    expect(deleted).toBe(2)

    const remaining = await execRepo.findRecentByTaskId(task.id)
    expect(remaining).toHaveLength(3)
    expect(remaining[0].started_at).toBe('2026-03-14T18:00:00.000Z')
  })

  it('returns 0 when nothing to trim', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    await execRepo.create({ taskId: task.id, startedAt: new Date() })

    const deleted = await execRepo.trimOldExecutions(task.id, 10)
    expect(deleted).toBe(0)
  })
})

describe('TaskExecutionRepository.recoverStaleRuns', () => {
  it('marks running executions as failed', async () => {
    const task = await taskRepo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    const exec1 = await execRepo.create({ taskId: task.id, startedAt: new Date() })
    const exec2 = await execRepo.create({ taskId: task.id, startedAt: new Date() })

    // Complete one so it should NOT be recovered
    await execRepo.complete(exec2.id, {
      status: 'success',
      productsTotal: 5,
      productsSucceeded: 5,
      productsFailed: 0,
      productsSkipped: 0,
      message: null,
    })

    const recovered = await execRepo.recoverStaleRuns()
    expect(recovered).toBe(1)

    const recent = await execRepo.findRecentByTaskId(task.id)
    const staleExec = recent.find((e) => e.id === exec1.id)
    expect(staleExec!.status).toBe('failed')
    expect(staleExec!.finished_at).not.toBeNull()
    expect(staleExec!.message).toBe('Interrupted by server restart')
  })

  it('returns 0 when no stale runs exist', async () => {
    const recovered = await execRepo.recoverStaleRuns()
    expect(recovered).toBe(0)
  })
})
