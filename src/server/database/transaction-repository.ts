// PRD-FEAT-014: Holdings Management
import { eq, and, asc, desc, gte, lte, count } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { transactions } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export interface TransactionFilter {
  readonly account_id?: number
  readonly product_id?: number
  readonly type?: 'buy' | 'sell'
  readonly from?: string
  readonly to?: string
}

export class TransactionRepository {
  constructor(private readonly db: Database) {}

  async findAll(filter?: TransactionFilter): Promise<readonly Transaction[]> {
    const conditions = buildFilterConditions(filter)
    const rows = await this.db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.tradedAt), desc(transactions.id))

    return rows.map(toTransaction)
  }

  async findByAccountAndProduct(
    accountId: number,
    productId: number,
  ): Promise<readonly Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.productId, productId),
        ),
      )
      .orderBy(asc(transactions.tradedAt), asc(transactions.id))

    return rows.map(toTransaction)
  }

  async findById(id: number): Promise<Transaction | undefined> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))

    return rows[0] ? toTransaction(rows[0]) : undefined
  }

  async create(input: CreateTransactionPayload): Promise<Transaction> {
    const rows = await this.db
      .insert(transactions)
      .values({
        accountId: input.account_id,
        productId: input.product_id,
        type: input.type,
        shares: String(input.shares),
        price: String(input.price),
        fee: String(input.fee ?? 0),
        tax: String(input.tax ?? 0),
        tradedAt: input.traded_at,
        memo: input.memo ?? '',
      })
      .returning()

    return toTransaction(rows[0])
  }

  async update(
    id: number,
    input: UpdateTransactionPayload,
  ): Promise<Transaction | undefined> {
    const updates: Partial<typeof transactions.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.type !== undefined) updates.type = input.type
    if (input.shares !== undefined) updates.shares = String(input.shares)
    if (input.price !== undefined) updates.price = String(input.price)
    if (input.fee !== undefined) updates.fee = String(input.fee)
    if (input.tax !== undefined) updates.tax = String(input.tax)
    if (input.traded_at !== undefined) updates.tradedAt = input.traded_at
    if (input.memo !== undefined) updates.memo = input.memo

    const rows = await this.db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning()

    return rows[0] ? toTransaction(rows[0]) : undefined
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id })

    return rows.length > 0
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(transactions)

    return result?.value ?? 0
  }
}

function buildFilterConditions(filter?: TransactionFilter) {
  const conditions: SQL[] = []
  if (filter?.account_id !== undefined) {
    conditions.push(eq(transactions.accountId, filter.account_id))
  }
  if (filter?.product_id !== undefined) {
    conditions.push(eq(transactions.productId, filter.product_id))
  }
  if (filter?.type !== undefined) {
    conditions.push(eq(transactions.type, filter.type))
  }
  if (filter?.from !== undefined) {
    conditions.push(gte(transactions.tradedAt, filter.from))
  }
  if (filter?.to !== undefined) {
    conditions.push(lte(transactions.tradedAt, filter.to))
  }
  return conditions
}

function toTransaction(
  row: typeof transactions.$inferSelect,
): Transaction {
  return {
    id: row.id,
    account_id: row.accountId,
    product_id: row.productId,
    type: row.type,
    shares: row.shares,
    price: row.price,
    fee: row.fee,
    tax: row.tax,
    traded_at: row.tradedAt,
    memo: row.memo ?? '',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
