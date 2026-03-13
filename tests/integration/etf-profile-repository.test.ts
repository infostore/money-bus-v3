// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { EtfProfileRepository } from '../../src/server/database/etf-profile-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'
import type { EtfManager } from '../../src/shared/types.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle<typeof schema>>
let repo: EtfProfileRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new EtfProfileRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE etf_profiles RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE etf_components RESTART IDENTITY CASCADE`)
  await db.execute(
    sql`INSERT INTO products (id, name, code, asset_type, currency) VALUES (999, 'Test ETF', 'TEST001', 'ETF', 'KRW') ON CONFLICT DO NOTHING`,
  )
})

describe('EtfProfileRepository', () => {
  const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

  describe('seedProfiles', () => {
    it('should insert new profiles for valid entries', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(1)
      expect(all[0].product_id).toBe(999)
      expect(all[0].manager).toBe('samsung-active')
      expect(all[0].download_url).toBe('https://example.com/test.xls')
    })

    it('should skip entries with unknown manager', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'unknown-manager' as EtfManager, expenseRatio: null, downloadUrl: 'https://example.com', downloadType: 'html' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(0)
    })

    it('should skip entries with missing productCode', async () => {
      const seeds = [
        { productCode: 'NONEXISTENT', manager: 'samsung-active' as EtfManager, expenseRatio: null, downloadUrl: 'https://example.com', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(0)
    })

    it('should not duplicate on re-seed (ON CONFLICT DO NOTHING)', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)
      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(1)
    })
  })

  describe('findAll', () => {
    it('should return empty array when no profiles exist', async () => {
      const all = await repo.findAll()
      expect(all).toEqual([])
    })
  })

  describe('findByProductId', () => {
    it('should return undefined when profile not found', async () => {
      const result = await repo.findByProductId(999)
      expect(result).toBeUndefined()
    })

    it('should return profile when found', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      await repo.seedProfiles(seeds, [{ id: 999, code: 'TEST001' }], VALID_MANAGERS)

      const result = await repo.findByProductId(999)
      expect(result).toBeDefined()
      expect(result!.product_id).toBe(999)
      expect(result!.manager).toBe('samsung-active')
    })
  })
})
