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

  async findLatestPricesWithReturns(): Promise<
    ReadonlyMap<number, {
      close: string; date: string;
      return_1w: number | null; return_1m: number | null;
      return_3m: number | null; return_1y: number | null;
    }>
  > {
    const rows = await this.db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (product_id) product_id, close, date
        FROM price_history
        ORDER BY product_id, date DESC
      )
      SELECT
        l.product_id, l.close, l.date,
        w.close AS close_1w,
        m.close AS close_1m,
        q.close AS close_3m,
        y.close AS close_1y
      FROM latest l
      LEFT JOIN LATERAL (
        SELECT close FROM price_history
        WHERE product_id = l.product_id AND date <= (l.date::date - 7)::text
        ORDER BY date DESC LIMIT 1
      ) w ON true
      LEFT JOIN LATERAL (
        SELECT close FROM price_history
        WHERE product_id = l.product_id AND date <= (l.date::date - 30)::text
        ORDER BY date DESC LIMIT 1
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT close FROM price_history
        WHERE product_id = l.product_id AND date <= (l.date::date - 90)::text
        ORDER BY date DESC LIMIT 1
      ) q ON true
      LEFT JOIN LATERAL (
        SELECT close FROM price_history
        WHERE product_id = l.product_id AND date <= (l.date::date - 365)::text
        ORDER BY date DESC LIMIT 1
      ) y ON true
    `)

    type Row = {
      product_id: number; close: string; date: string;
      close_1w: string | null; close_1m: string | null;
      close_3m: string | null; close_1y: string | null;
    }
    const result = new Map<number, {
      close: string; date: string;
      return_1w: number | null; return_1m: number | null;
      return_3m: number | null; return_1y: number | null;
    }>()
    for (const row of (rows as unknown as { rows: Row[] }).rows) {
      result.set(row.product_id, {
        close: row.close,
        date: row.date,
        return_1w: calcReturn(row.close, row.close_1w),
        return_1m: calcReturn(row.close, row.close_1m),
        return_3m: calcReturn(row.close, row.close_3m),
        return_1y: calcReturn(row.close, row.close_1y),
      })
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

function calcReturn(current: string, past: string | null): number | null {
  if (!past) return null
  const cur = Number(current)
  const prev = Number(past)
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 10000) / 100
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
