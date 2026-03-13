// PRD-FEAT-005: Price History Scheduler
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { scheduledTasks } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { ScheduledTask } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

interface SeedDefaultInput {
  readonly name: string
  readonly cronExpression: string
  readonly enabled: boolean
}

export class ScheduledTaskRepository {
  constructor(private readonly db: Database) {}

  async seedDefault(input: SeedDefaultInput): Promise<ScheduledTask> {
    await this.db
      .insert(scheduledTasks)
      .values({
        name: input.name,
        cronExpression: input.cronExpression,
        enabled: input.enabled,
      })
      .onConflictDoNothing({ target: scheduledTasks.name })

    const rows = await this.db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.name, input.name))

    return toScheduledTask(rows[0])
  }

  async findEnabled(): Promise<readonly ScheduledTask[]> {
    const rows = await this.db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.enabled, true))
      .orderBy(asc(scheduledTasks.id))

    return rows.map(toScheduledTask)
  }

  async findByName(name: string): Promise<ScheduledTask | undefined> {
    const rows = await this.db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.name, name))

    return rows[0] ? toScheduledTask(rows[0]) : undefined
  }
}

function toScheduledTask(
  row: typeof scheduledTasks.$inferSelect,
): ScheduledTask {
  return {
    id: row.id,
    name: row.name,
    cron_expression: row.cronExpression,
    enabled: row.enabled,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
