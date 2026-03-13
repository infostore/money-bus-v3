// PRD-FEAT-005: Price History Scheduler
import { eq, desc, asc, max, sql, and, gte, lte } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { priceHistory } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { PriceHistory } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export interface PriceRow {
  readonly productId: number
  readonly date: string
  readonly open: string | null
  readonly high: string | null
  readonly low: string | null
  readonly close: string
  readonly volume: number | null
}

export class PriceHistoryRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(rows: readonly PriceRow[]): Promise<number> {
    if (rows.length === 0) {
      return 0
    }

    const result = await this.db
      .insert(priceHistory)
      .values(
        rows.map((r) => ({
          productId: r.productId,
          date: r.date,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
        })),
      )
      .onConflictDoUpdate({
        target: [priceHistory.productId, priceHistory.date],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
        },
      })
      .returning({ id: priceHistory.id })

    return result.length
  }

  async findLastDate(productId: number): Promise<string | undefined> {
    const [result] = await this.db
      .select({ maxDate: max(priceHistory.date) })
      .from(priceHistory)
      .where(eq(priceHistory.productId, productId))

    return result?.maxDate ?? undefined
  }

  async findByProductIdInRange(
    productId: number,
    from?: string,
    to?: string,
  ): Promise<readonly PriceHistory[]> {
    const conditions = [eq(priceHistory.productId, productId)]

    if (from) {
      conditions.push(gte(priceHistory.date, from))
    }
    if (to) {
      conditions.push(lte(priceHistory.date, to))
    }

    const rows = await this.db
      .select()
      .from(priceHistory)
      .where(and(...conditions))
      .orderBy(asc(priceHistory.date))

    return rows.map(toPriceHistory)
  }

  async findLatestPrices(): Promise<ReadonlyMap<number, { close: string; date: string }>> {
    const rows = await this.db.execute(sql`
      SELECT DISTINCT ON (product_id) product_id, close, date
      FROM price_history
      ORDER BY product_id, date DESC
    `)
    const result = new Map<number, { close: string; date: string }>()
    for (const row of (rows as unknown as { rows: Array<{ product_id: number; close: string; date: string }> }).rows) {
      result.set(row.product_id, { close: row.close, date: row.date })
    }
    return result
  }

  async findByProductId(productId: number): Promise<readonly PriceHistory[]> {
    const rows = await this.db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, productId))
      .orderBy(desc(priceHistory.date))

    return rows.map(toPriceHistory)
  }
}

function toPriceHistory(
  row: typeof priceHistory.$inferSelect,
): PriceHistory {
  return {
    id: row.id,
    product_id: row.productId,
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    created_at: row.createdAt.toISOString(),
  }
}
