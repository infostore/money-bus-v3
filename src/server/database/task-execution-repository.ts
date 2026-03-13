// PRD-FEAT-005: Price History Scheduler
import { eq, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { taskExecutions } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { TaskExecution } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

interface CreateExecutionInput {
  readonly taskId: number
  readonly startedAt: Date
}

interface CompleteExecutionResult {
  readonly status: 'success' | 'partial' | 'failed'
  readonly productsTotal: number
  readonly productsSucceeded: number
  readonly productsFailed: number
  readonly productsSkipped: number
  readonly message: string | null
}

const DEFAULT_LIMIT = 10

export class TaskExecutionRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateExecutionInput): Promise<TaskExecution> {
    const rows = await this.db
      .insert(taskExecutions)
      .values({
        taskId: input.taskId,
        startedAt: input.startedAt,
        status: 'running',
      })
      .returning()

    return toTaskExecution(rows[0])
  }

  async complete(
    id: number,
    result: CompleteExecutionResult,
  ): Promise<TaskExecution | undefined> {
    const rows = await this.db
      .update(taskExecutions)
      .set({
        finishedAt: new Date(),
        status: result.status,
        productsTotal: result.productsTotal,
        productsSucceeded: result.productsSucceeded,
        productsFailed: result.productsFailed,
        productsSkipped: result.productsSkipped,
        message: result.message,
      })
      .where(eq(taskExecutions.id, id))
      .returning()

    return rows[0] ? toTaskExecution(rows[0]) : undefined
  }

  async findRecentByTaskId(
    taskId: number,
    limit: number = DEFAULT_LIMIT,
  ): Promise<readonly TaskExecution[]> {
    const rows = await this.db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit)

    return rows.map(toTaskExecution)
  }

  async trimOldExecutions(
    taskId: number,
    keep: number = DEFAULT_LIMIT,
  ): Promise<number> {
    const keepIds = this.db
      .select({ id: taskExecutions.id })
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, taskId))
      .orderBy(desc(taskExecutions.startedAt))
      .limit(keep)

    const deleted = await this.db
      .delete(taskExecutions)
      .where(
        sql`${taskExecutions.taskId} = ${taskId} AND ${taskExecutions.id} NOT IN (${keepIds})`,
      )
      .returning({ id: taskExecutions.id })

    return deleted.length
  }

  async recoverStaleRuns(): Promise<number> {
    const rows = await this.db
      .update(taskExecutions)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        message: 'Interrupted by server restart',
      })
      .where(eq(taskExecutions.status, 'running'))
      .returning({ id: taskExecutions.id })

    return rows.length
  }
}

function toTaskExecution(
  row: typeof taskExecutions.$inferSelect,
): TaskExecution {
  return {
    id: row.id,
    task_id: row.taskId,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt ? row.finishedAt.toISOString() : null,
    status: row.status as TaskExecution['status'],
    products_total: row.productsTotal,
    products_succeeded: row.productsSucceeded,
    products_failed: row.productsFailed,
    products_skipped: row.productsSkipped,
    message: row.message,
    created_at: row.createdAt.toISOString(),
  }
}
