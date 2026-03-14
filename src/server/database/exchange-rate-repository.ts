// PRD-FEAT-016: Exchange Rate Repository
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { exchangeRates } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { ExchangeRate } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class ExchangeRateRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly ExchangeRate[]> {
    const rows = await this.db
      .select()
      .from(exchangeRates)
      .orderBy(asc(exchangeRates.currency))

    return rows.map(toExchangeRate)
  }

  async findByCurrency(currency: string): Promise<ExchangeRate | undefined> {
    const rows = await this.db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.currency, currency))

    return rows[0] ? toExchangeRate(rows[0]) : undefined
  }

  async upsert(currency: string, rate: number): Promise<ExchangeRate> {
    const rows = await this.db
      .insert(exchangeRates)
      .values({ currency, rate: String(rate) })
      .onConflictDoUpdate({
        target: exchangeRates.currency,
        set: { rate: String(rate), updatedAt: new Date() },
      })
      .returning()

    return toExchangeRate(rows[0])
  }

  async getRate(currency: string): Promise<number> {
    const row = await this.findByCurrency(currency)
    return row ? parseFloat(row.rate) : 1.0
  }
}

function toExchangeRate(row: typeof exchangeRates.$inferSelect): ExchangeRate {
  return {
    id: row.id,
    currency: row.currency,
    rate: row.rate!,
    updated_at: row.updatedAt.toISOString(),
  }
}
