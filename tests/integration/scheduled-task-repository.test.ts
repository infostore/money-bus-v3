// PRD-FEAT-005: Price History Scheduler - ScheduledTask Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ScheduledTaskRepository } from '../../src/server/database/scheduled-task-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let repo: ScheduledTaskRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new ScheduledTaskRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE scheduled_tasks RESTART IDENTITY CASCADE`,
  )
})

describe('ScheduledTaskRepository.seedDefault', () => {
  it('creates a new task', async () => {
    const task = await repo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    expect(task.id).toBeGreaterThan(0)
    expect(task.name).toBe('price-fetch')
    expect(task.cron_expression).toBe('0 18 * * 1-5')
    expect(task.enabled).toBe(true)
    expect(task.created_at).toBeDefined()
    expect(task.updated_at).toBeDefined()
  })

  it('is idempotent — calling twice returns the same task', async () => {
    const first = await repo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 18 * * 1-5',
      enabled: true,
    })

    const second = await repo.seedDefault({
      name: 'price-fetch',
      cronExpression: '0 9 * * 1-5',
      enabled: false,
    })

    expect(second.id).toBe(first.id)
    expect(second.cron_expression).toBe('0 18 * * 1-5')
    expect(second.enabled).toBe(true)
  })
})

describe('ScheduledTaskRepository.findEnabled', () => {
  it('returns only enabled tasks', async () => {
    await repo.seedDefault({ name: 'enabled-task', cronExpression: '* * * * *', enabled: true })
    await repo.seedDefault({ name: 'disabled-task', cronExpression: '* * * * *', enabled: false })

    const result = await repo.findEnabled()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('enabled-task')
  })

  it('returns empty array when none enabled', async () => {
    await repo.seedDefault({ name: 'disabled-task', cronExpression: '* * * * *', enabled: false })

    const result = await repo.findEnabled()
    expect(result).toEqual([])
  })
})

describe('ScheduledTaskRepository.findByName', () => {
  it('returns the task', async () => {
    await repo.seedDefault({ name: 'price-fetch', cronExpression: '0 18 * * 1-5', enabled: true })

    const found = await repo.findByName('price-fetch')
    expect(found).toBeDefined()
    expect(found!.name).toBe('price-fetch')
    expect(found!.cron_expression).toBe('0 18 * * 1-5')
  })

  it('returns undefined for non-existent name', async () => {
    const found = await repo.findByName('non-existent')
    expect(found).toBeUndefined()
  })
})
