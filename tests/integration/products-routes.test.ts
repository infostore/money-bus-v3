// PRD-FEAT-004: Product Management - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { ProductRepository } from '../../src/server/database/product-repository.js'
import { createProductRoutes } from '../../src/server/routes/products.js'

const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  const repo = new ProductRepository(db)
  app = new Hono()
  app.route('/api/products', createProductRoutes(repo))
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
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

describe('GET /api/products', () => {
  it('returns empty array when no products exist', async () => {
    const res = await request('GET', '/api/products')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns all products sorted by name ASC', async () => {
    await request('POST', '/api/products', { name: '비트코인', asset_type: '암호화폐' })
    await request('POST', '/api/products', { name: 'Apple', asset_type: '주식' })

    const res = await request('GET', '/api/products')
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('Apple')
    expect(json.data[1].name).toBe('비트코인')
  })
})

describe('POST /api/products', () => {
  it('creates a product and returns 201', async () => {
    const res = await request('POST', '/api/products', {
      name: '삼성전자',
      code: '005930',
      asset_type: '주식',
      currency: 'KRW',
      exchange: 'KOSPI',
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('삼성전자')
    expect(json.data.code).toBe('005930')
    expect(json.data.asset_type).toBe('주식')
    expect(json.data.id).toBeGreaterThan(0)
  })

  it('defaults asset_type to 기타, currency to KRW, code and exchange to null', async () => {
    const res = await request('POST', '/api/products', {
      name: '테스트종목',
    })
    const json = await res.json()
    expect(json.data.asset_type).toBe('기타')
    expect(json.data.currency).toBe('KRW')
    expect(json.data.code).toBeNull()
    expect(json.data.exchange).toBeNull()
  })

  it('returns 400 for empty name', async () => {
    const res = await request('POST', '/api/products', { name: '' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('종목명을 입력해주세요.')
  })

  it('returns 400 for missing name', async () => {
    const res = await request('POST', '/api/products', { asset_type: '주식' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 409 for duplicate name', async () => {
    await request('POST', '/api/products', { name: '삼성전자' })
    const res = await request('POST', '/api/products', { name: '삼성전자' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('이미 등록된 종목입니다.')
  })

  it('trims whitespace from name', async () => {
    const res = await request('POST', '/api/products', { name: '  삼성전자  ' })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.name).toBe('삼성전자')
  })

  it('returns 400 for invalid asset_type', async () => {
    const res = await request('POST', '/api/products', {
      name: '테스트',
      asset_type: '부동산',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PUT /api/products/:id', () => {
  it('updates a product', async () => {
    const createRes = await request('POST', '/api/products', {
      name: '삼성전자',
      asset_type: '주식',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, {
      name: 'Samsung Electronics',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('Samsung Electronics')
  })

  it('returns 400 for empty update body', async () => {
    const createRes = await request('POST', '/api/products', {
      name: '삼성전자',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, {})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('최소 하나의 필드를 입력해주세요.')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('PUT', '/api/products/999', { name: '없음' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id (NaN)', async () => {
    const res = await request('PUT', '/api/products/abc', { name: '없음' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name with different product', async () => {
    await request('POST', '/api/products', { name: '삼성전자' })
    const createRes = await request('POST', '/api/products', { name: 'Apple' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, { name: '삼성전자' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('이미 등록된 종목입니다.')
  })

  it('returns 400 for invalid asset_type', async () => {
    const createRes = await request('POST', '/api/products', { name: '삼성전자' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, {
      asset_type: '부동산',
    })
    expect(res.status).toBe(400)
  })

  it('succeeds when self-updating with same name', async () => {
    const createRes = await request('POST', '/api/products', {
      name: '삼성전자',
      asset_type: '주식',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, {
      name: '삼성전자',
      asset_type: 'ETF',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.asset_type).toBe('ETF')
  })

  it('rejects unknown fields with strict schema', async () => {
    const createRes = await request('POST', '/api/products', { name: '삼성전자' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/products/${id}`, {
      name: 'Apple',
      unknownField: 'test',
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/products/:id', () => {
  it('deletes a product (200)', async () => {
    const createRes = await request('POST', '/api/products', { name: '삼성전자' })
    const { id } = (await createRes.json()).data

    const res = await request('DELETE', `/api/products/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/products/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('DELETE', '/api/products/abc')
    expect(res.status).toBe(400)
  })
})
