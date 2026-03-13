// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { EtfComponentRepository } from '../../src/server/database/etf-component-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'
import type { CreateEtfComponentPayload } from '../../src/shared/types.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle<typeof schema>>
let repo: EtfComponentRepository

const PRODUCT_ID = 999

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new EtfComponentRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE etf_components RESTART IDENTITY CASCADE`)
  await db.execute(
    sql`INSERT INTO products (id, name, code, asset_type, currency) VALUES (${PRODUCT_ID}, 'Test ETF', 'TEST001', 'ETF', 'KRW') ON CONFLICT DO NOTHING`,
  )
})

function makePayload(overrides: Partial<CreateEtfComponentPayload> = {}): CreateEtfComponentPayload {
  return {
    etf_product_id: PRODUCT_ID,
    component_symbol: '005930',
    component_name: '삼성전자',
    weight: '25.5000',
    shares: 1000,
    snapshot_date: '2026-03-13',
    ...overrides,
  }
}

describe('EtfComponentRepository', () => {
  describe('upsertMany', () => {
    it('should insert new component rows', async () => {
      const rows = [
        makePayload({ component_symbol: '005930', weight: '25.5000' }),
        makePayload({ component_symbol: '000660', component_name: 'SK하이닉스', weight: '15.3000' }),
      ]

      await repo.upsertMany(rows)

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(2)
    })

    it('should update existing rows on conflict (upsert)', async () => {
      await repo.upsertMany([makePayload({ weight: '20.0000' })])
      await repo.upsertMany([makePayload({ weight: '25.5000' })])

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(1)
      expect(result[0].weight).toBe('25.5000')
    })

    it('should handle empty array gracefully', async () => {
      await repo.upsertMany([])
      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(0)
    })
  })

  describe('findByProductAndDate', () => {
    it('should return components sorted by weight DESC (numeric sort)', async () => {
      await repo.upsertMany([
        makePayload({ component_symbol: 'A', weight: '5.0000' }),
        makePayload({ component_symbol: 'B', weight: '25.5000' }),
        makePayload({ component_symbol: 'C', weight: '10.0000' }),
      ])

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result.map((r) => r.component_symbol)).toEqual(['B', 'C', 'A'])
    })

    it('should return empty array when no data for date', async () => {
      const result = await repo.findByProductAndDate(PRODUCT_ID, '2099-01-01')
      expect(result).toEqual([])
    })
  })

  describe('findDatesByProduct', () => {
    it('should return distinct dates sorted DESC', async () => {
      await repo.upsertMany([
        makePayload({ snapshot_date: '2026-03-10' }),
        makePayload({ snapshot_date: '2026-03-13', component_symbol: 'A' }),
        makePayload({ snapshot_date: '2026-03-11', component_symbol: 'B' }),
      ])

      const dates = await repo.findDatesByProduct(PRODUCT_ID)
      expect(dates).toEqual(['2026-03-13', '2026-03-11', '2026-03-10'])
    })

    it('should return empty array when no data', async () => {
      const dates = await repo.findDatesByProduct(PRODUCT_ID)
      expect(dates).toEqual([])
    })
  })

  describe('hasSnapshot', () => {
    it('should return false when no snapshot exists', async () => {
      const result = await repo.hasSnapshot(PRODUCT_ID, '2026-03-13')
      expect(result).toBe(false)
    })

    it('should return true when snapshot exists', async () => {
      await repo.upsertMany([makePayload()])
      const result = await repo.hasSnapshot(PRODUCT_ID, '2026-03-13')
      expect(result).toBe(true)
    })
  })
})
