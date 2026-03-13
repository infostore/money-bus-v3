// PRD-FEAT-007: ETF Detail Page - Price History Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { ProductRepository } from '../../src/server/database/product-repository.js'
import { PriceHistoryRepository, type PriceRow } from '../../src/server/database/price-history-repository.js'
import { createProductRoutes } from '../../src/server/routes/products.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono
let productRepo: ProductRepository
let priceHistoryRepo: PriceHistoryRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  productRepo = new ProductRepository(db)
  priceHistoryRepo = new PriceHistoryRepository(db)
  app = new Hono()
  app.route('/api/products', createProductRoutes(productRepo, priceHistoryRepo))
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

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return app.request(path, init)
}

describe('GET /api/products/:id/price-history', () => {
  it('returns 200 with all rows when no params', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const rows: readonly PriceRow[] = [
      { productId: product.id, date: '2024-01-01', open: '100.0000', high: '105.0000', low: '99.0000', close: '103.0000', volume: 1000000 },
      { productId: product.id, date: '2024-01-02', open: '103.0000', high: '107.0000', low: '102.0000', close: '106.0000', volume: 1200000 },
    ]
    await priceHistoryRepo.upsertMany(rows)

    const res = await request('GET', `/api/products/${product.id}/price-history`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].date).toBe('2024-01-01')
    expect(json.data[1].date).toBe('2024-01-02')
  })

  it('returns 200 with filtered rows when from/to provided', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const rows: readonly PriceRow[] = [
      { productId: product.id, date: '2024-01-01', open: null, high: null, low: null, close: '100.0000', volume: null },
      { productId: product.id, date: '2024-01-02', open: null, high: null, low: null, close: '101.0000', volume: null },
      { productId: product.id, date: '2024-01-03', open: null, high: null, low: null, close: '102.0000', volume: null },
      { productId: product.id, date: '2024-01-04', open: null, high: null, low: null, close: '103.0000', volume: null },
    ]
    await priceHistoryRepo.upsertMany(rows)

    const res = await request('GET', `/api/products/${product.id}/price-history?from=2024-01-02&to=2024-01-03`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].date).toBe('2024-01-02')
    expect(json.data[1].date).toBe('2024-01-03')
  })

  it('returns 400 for invalid date format', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const res = await request('GET', `/api/products/${product.id}/price-history?from=2024/01/01`)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('날짜 형식이 올바르지 않습니다.')
  })

  it('returns 404 for non-existent product', async () => {
    const res = await request('GET', '/api/products/999/price-history')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('종목을 찾을 수 없습니다.')
  })

  it('returns 400 for non-numeric ID', async () => {
    const res = await request('GET', '/api/products/abc/price-history')
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('유효하지 않은 종목 ID입니다.')
  })

  it('returns empty array when product exists but has no price data', async () => {
    const product = await productRepo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })

    const res = await request('GET', `/api/products/${product.id}/price-history`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })
})
