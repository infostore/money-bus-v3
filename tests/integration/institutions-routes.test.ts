// PRD-FEAT-002: Institution Management - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { InstitutionRepository } from '../../src/server/database/institution-repository.js'
import { createInstitutionRoutes } from '../../src/server/routes/institutions.js'

const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  const repo = new InstitutionRepository(db)
  app = new Hono()
  app.route('/api/institutions', createInstitutionRoutes(repo))
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`,
  )
})

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return app.request(path, init)
}

describe('GET /api/institutions', () => {
  it('returns empty array when no institutions exist', async () => {
    const res = await request('GET', '/api/institutions')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns all institutions sorted by name', async () => {
    await request('POST', '/api/institutions', { name: '키움증권', category: '증권' })
    await request('POST', '/api/institutions', { name: '국민은행', category: '은행' })

    const res = await request('GET', '/api/institutions')
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('국민은행')
    expect(json.data[1].name).toBe('키움증권')
  })

  it('filters by category when query param provided', async () => {
    await request('POST', '/api/institutions', { name: '삼성증권', category: '증권' })
    await request('POST', '/api/institutions', { name: '국민은행', category: '은행' })
    await request('POST', '/api/institutions', { name: '삼성자산운용', category: '운용사' })

    const res = await request('GET', '/api/institutions?category=증권')
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('삼성증권')
  })
})

describe('POST /api/institutions', () => {
  it('creates an institution and returns 201', async () => {
    const res = await request('POST', '/api/institutions', {
      name: '삼성증권',
      category: '증권',
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('삼성증권')
    expect(json.data.category).toBe('증권')
    expect(json.data.id).toBeGreaterThan(0)
  })

  it('defaults category to 증권', async () => {
    const res = await request('POST', '/api/institutions', {
      name: '테스트기관',
    })
    const json = await res.json()
    expect(json.data.category).toBe('증권')
  })

  it('returns 400 for invalid input (empty name)', async () => {
    const res = await request('POST', '/api/institutions', { name: '' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 for missing name', async () => {
    const res = await request('POST', '/api/institutions', { category: '은행' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name', async () => {
    await request('POST', '/api/institutions', { name: '삼성증권' })
    const res = await request('POST', '/api/institutions', { name: '삼성증권' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('이미 등록된 기관명입니다.')
  })

  it('trims whitespace from name', async () => {
    const res = await request('POST', '/api/institutions', { name: '  삼성증권  ' })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.name).toBe('삼성증권')
  })

  it('returns 400 for invalid category', async () => {
    const res = await request('POST', '/api/institutions', {
      name: '테스트',
      category: '보험',
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/institutions/:id', () => {
  it('updates an institution', async () => {
    const createRes = await request('POST', '/api/institutions', {
      name: '삼성증권',
      category: '증권',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, {
      name: 'KB증권',
      category: '증권',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('KB증권')
  })

  it('returns 400 for empty update body', async () => {
    const createRes = await request('POST', '/api/institutions', {
      name: '삼성증권',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, {})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('At least one field')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('PUT', '/api/institutions/999', { name: '없음' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('PUT', '/api/institutions/abc', { name: '없음' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name with different institution', async () => {
    await request('POST', '/api/institutions', { name: '삼성증권' })
    const createRes = await request('POST', '/api/institutions', { name: 'KB증권' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, { name: '삼성증권' })
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid update payload', async () => {
    const createRes = await request('POST', '/api/institutions', { name: '삼성증권' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, {
      category: '보험',
    })
    expect(res.status).toBe(400)
  })

  it('succeeds when self-updating with same name', async () => {
    const createRes = await request('POST', '/api/institutions', {
      name: '삼성증권',
      category: '증권',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, {
      name: '삼성증권',
      category: '은행',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.category).toBe('은행')
  })

  it('rejects unknown fields with strict schema', async () => {
    const createRes = await request('POST', '/api/institutions', { name: '삼성증권' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/institutions/${id}`, {
      name: 'KB증권',
      unknownField: 'test',
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/institutions/:id', () => {
  it('deletes an institution', async () => {
    const createRes = await request('POST', '/api/institutions', { name: '삼성증권' })
    const { id } = (await createRes.json()).data

    const res = await request('DELETE', `/api/institutions/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/institutions/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('DELETE', '/api/institutions/abc')
    expect(res.status).toBe(400)
  })
})

describe('InstitutionRepository.seed', () => {
  it('seeds 25 default institutions', async () => {
    const repo = new InstitutionRepository(db)
    await repo.seed()
    const all = await repo.findAll()
    expect(all).toHaveLength(25)
  })

  it('count returns correct number', async () => {
    const repo = new InstitutionRepository(db)
    expect(await repo.count()).toBe(0)
    await repo.seed()
    expect(await repo.count()).toBe(25)
  })

  it('seed respects category filter', async () => {
    const repo = new InstitutionRepository(db)
    await repo.seed()
    const securities = await repo.findAll('증권')
    expect(securities).toHaveLength(10)
    const banks = await repo.findAll('은행')
    expect(banks).toHaveLength(5)
    const assetManagers = await repo.findAll('운용사')
    expect(assetManagers).toHaveLength(10)
  })
})
