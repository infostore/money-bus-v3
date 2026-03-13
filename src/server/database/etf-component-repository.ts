// PRD-FEAT-012: ETF Component Collection Scheduler
import { eq, and, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { etfComponents } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { EtfComponent, CreateEtfComponentPayload } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class EtfComponentRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(rows: readonly CreateEtfComponentPayload[]): Promise<void> {
    if (rows.length === 0) return

    await this.db
      .insert(etfComponents)
      .values(
        rows.map((r) => ({
          etfProductId: r.etf_product_id,
          componentSymbol: r.component_symbol,
          componentName: r.component_name,
          weight: r.weight ?? null,
          shares: r.shares ?? null,
          snapshotDate: r.snapshot_date,
        })),
      )
      .onConflictDoUpdate({
        target: [etfComponents.etfProductId, etfComponents.componentSymbol, etfComponents.snapshotDate],
        set: {
          componentName: sql`excluded.component_name`,
          weight: sql`excluded.weight`,
          shares: sql`excluded.shares`,
        },
      })
  }

  async findByProductAndDate(
    productId: number,
    snapshotDate: string,
  ): Promise<readonly EtfComponent[]> {
    const rows = await this.db
      .select()
      .from(etfComponents)
      .where(
        and(
          eq(etfComponents.etfProductId, productId),
          eq(etfComponents.snapshotDate, snapshotDate),
        ),
      )
      .orderBy(desc(etfComponents.weight))

    return rows.map(toEtfComponent)
  }

  async findDatesByProduct(productId: number): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ snapshotDate: etfComponents.snapshotDate })
      .from(etfComponents)
      .where(eq(etfComponents.etfProductId, productId))
      .orderBy(desc(etfComponents.snapshotDate))

    return rows.map((r) => r.snapshotDate)
  }

  async hasSnapshot(productId: number, snapshotDate: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: etfComponents.id })
      .from(etfComponents)
      .where(
        and(
          eq(etfComponents.etfProductId, productId),
          eq(etfComponents.snapshotDate, snapshotDate),
        ),
      )
      .limit(1)

    return rows.length > 0
  }
}

function toEtfComponent(
  row: typeof etfComponents.$inferSelect,
): EtfComponent {
  return {
    id: row.id,
    etf_product_id: row.etfProductId,
    component_symbol: row.componentSymbol,
    component_name: row.componentName,
    weight: row.weight,
    shares: row.shares,
    snapshot_date: row.snapshotDate,
    created_at: row.createdAt.toISOString(),
  }
}
