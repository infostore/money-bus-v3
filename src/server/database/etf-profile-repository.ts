// PRD-FEAT-012: ETF Component Collection Scheduler
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { etfProfiles } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { EtfProfile, EtfManager } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

type Database = NodePgDatabase<typeof schemaTypes>

export interface EtfProfileSeedEntry {
  readonly productCode: string
  readonly manager: string
  readonly expenseRatio: string | null
  readonly downloadUrl: string
  readonly downloadType: 'xls' | 'html'
}

export class EtfProfileRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly EtfProfile[]> {
    const rows = await this.db
      .select()
      .from(etfProfiles)
      .orderBy(asc(etfProfiles.id))

    return rows.map(toEtfProfile)
  }

  async findByProductId(productId: number): Promise<EtfProfile | undefined> {
    const rows = await this.db
      .select()
      .from(etfProfiles)
      .where(eq(etfProfiles.productId, productId))

    return rows[0] ? toEtfProfile(rows[0]) : undefined
  }

  async seedProfiles(
    seeds: readonly EtfProfileSeedEntry[],
    products: readonly { readonly id: number; readonly code: string | null }[],
    validManagers: readonly EtfManager[],
  ): Promise<void> {
    const productMap = new Map(
      products.filter((p) => p.code !== null).map((p) => [p.code!, p.id]),
    )

    for (const seed of seeds) {
      if (!validManagers.includes(seed.manager as EtfManager)) {
        log('warn', `ETF seed skipped: unknown manager '${seed.manager}' for product code '${seed.productCode}'`)
        continue
      }

      const productId = productMap.get(seed.productCode)
      if (productId === undefined) {
        log('warn', `ETF seed skipped: product code '${seed.productCode}' not found in products table`)
        continue
      }

      await this.db
        .insert(etfProfiles)
        .values({
          productId,
          manager: seed.manager,
          expenseRatio: seed.expenseRatio,
          downloadUrl: seed.downloadUrl,
          downloadType: seed.downloadType,
        })
        .onConflictDoNothing({ target: etfProfiles.productId })
    }
  }
}

function toEtfProfile(row: typeof etfProfiles.$inferSelect): EtfProfile {
  return {
    id: row.id,
    product_id: row.productId,
    manager: row.manager as EtfManager,
    expense_ratio: row.expenseRatio,
    download_url: row.downloadUrl,
    download_type: row.downloadType as 'xls' | 'html',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
