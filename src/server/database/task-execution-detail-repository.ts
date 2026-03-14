// PRD-FEAT-018: Task Execution Detail
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { taskExecutionDetails, products } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { TaskExecutionDetail, CreateDetailInput } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class TaskExecutionDetailRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateDetailInput): Promise<void> {
    await this.db
      .insert(taskExecutionDetails)
      .values({
        executionId: input.executionId,
        productId: input.productId,
        status: input.status,
        message: input.message ?? null,
      })
  }

  async createMany(inputs: readonly CreateDetailInput[]): Promise<void> {
    if (inputs.length === 0) return

    await this.db
      .insert(taskExecutionDetails)
      .values(
        inputs.map((input) => ({
          executionId: input.executionId,
          productId: input.productId,
          status: input.status,
          message: input.message ?? null,
        })),
      )
  }

  async findByExecutionId(executionId: number): Promise<readonly TaskExecutionDetail[]> {
    const rows = await this.db
      .select({
        detail: taskExecutionDetails,
        productName: products.name,
        productCode: products.code,
      })
      .from(taskExecutionDetails)
      .leftJoin(products, eq(taskExecutionDetails.productId, products.id))
      .where(eq(taskExecutionDetails.executionId, executionId))
      .orderBy(asc(taskExecutionDetails.id))

    return rows.map((r) => toDetail(r.detail, r.productName, r.productCode))
  }
}

function toDetail(
  row: typeof taskExecutionDetails.$inferSelect,
  productName: string | null,
  productCode: string | null,
): TaskExecutionDetail {
  return {
    id: row.id,
    execution_id: row.executionId,
    product_id: row.productId,
    product_name: productName,
    product_code: productCode,
    status: row.status as TaskExecutionDetail['status'],
    message: row.message,
    created_at: row.createdAt.toISOString(),
  }
}
