// PRD-FEAT-005: Price History Scheduler - Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ProductRepository } from '../../src/server/database/product-repository.js'
import {
  PriceHistoryRepository,
  type PriceRow,
} from '../../src/server/database/price-history-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let productRepo: ProductRepository
let repo: PriceHistoryRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  productRepo = new ProductRepository(db)
  repo = new PriceHistoryRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`,
  )
  await db.execute(
    sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`,
  )
})

describe('PriceHistoryRepository.upsertMany', () => {
  it('inserts new rows', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const rows: readonly PriceRow[] = [
      { productId: product.id, date: '2024-01-01', open: '100.0000', high: '105.0000', low: '99.0000', close: '103.0000', volume: 1000000 },
      { productId: product.id, date: '2024-01-02', open: '103.0000', high: '107.0000', low: '102.0000', close: '106.0000', volume: 1200000 },
    ]

    const count = await repo.upsertMany(rows)
    expect(count).toBe(2)

    const stored = await repo.findByProductId(product.id)
    expect(stored).toHaveLength(2)
    expect(stored[0].close).toBe('106.0000')
    expect(stored[1].close).toBe('103.0000')
  })

  it('updates existing rows on conflict (same product_id + date)', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const initialRows: readonly PriceRow[] = [
      { productId: product.id, date: '2024-01-01', open: '100.0000', high: '105.0000', low: '99.0000', close: '103.0000', volume: 1000000 },
    ]
    await repo.upsertMany(initialRows)

    const updatedRows: readonly PriceRow[] = [
      { productId: product.id, date: '2024-01-01', open: '101.0000', high: '110.0000', low: '98.0000', close: '109.0000', volume: 1500000 },
    ]
    const count = await repo.upsertMany(updatedRows)
    expect(count).toBe(1)

    const stored = await repo.findByProductId(product.id)
    expect(stored).toHaveLength(1)
    expect(stored[0].close).toBe('109.0000')
    expect(stored[0].high).toBe('110.0000')
    expect(stored[0].volume).toBe(1500000)
  })

  it('returns 0 for empty array', async () => {
    const count = await repo.upsertMany([])
    expect(count).toBe(0)
  })
})

describe('PriceHistoryRepository.findLastDate', () => {
  it('returns the latest date for a product', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    await repo.upsertMany([
      { productId: product.id, date: '2024-01-01', open: null, high: null, low: null, close: '100.0000', volume: null },
      { productId: product.id, date: '2024-03-15', open: null, high: null, low: null, close: '120.0000', volume: null },
      { productId: product.id, date: '2024-02-10', open: null, high: null, low: null, close: '110.0000', volume: null },
    ])

    const lastDate = await repo.findLastDate(product.id)
    expect(lastDate).toBe('2024-03-15')
  })

  it('returns undefined when no rows exist', async () => {
    const lastDate = await repo.findLastDate(999)
    expect(lastDate).toBeUndefined()
  })
})

describe('PriceHistoryRepository.findByProductId', () => {
  it('returns rows sorted by date DESC', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    await repo.upsertMany([
      { productId: product.id, date: '2024-01-01', open: null, high: null, low: null, close: '100.0000', volume: null },
      { productId: product.id, date: '2024-01-03', open: null, high: null, low: null, close: '102.0000', volume: null },
      { productId: product.id, date: '2024-01-02', open: null, high: null, low: null, close: '101.0000', volume: null },
    ])

    const result = await repo.findByProductId(product.id)
    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2024-01-03')
    expect(result[1].date).toBe('2024-01-02')
    expect(result[2].date).toBe('2024-01-01')
  })

  it('returns empty array for product with no prices', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })
    const result = await repo.findByProductId(product.id)
    expect(result).toEqual([])
  })
})
