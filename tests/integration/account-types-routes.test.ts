// PRD-FEAT-003: Account Type Management - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { AccountTypeRepository } from '../../src/server/database/account-type-repository.js'
import { createAccountTypeRoutes } from '../../src/server/routes/account-types.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  const repo = new AccountTypeRepository(db)
  app = new Hono()
  app.route('/api/account-types', createAccountTypeRoutes(repo))
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`,
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

describe('GET /api/account-types', () => {
  it('returns empty array when no types exist', async () => {
    const res = await request('GET', '/api/account-types')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns all types sorted by name ASC', async () => {
    await request('POST', '/api/account-types', { name: '적금', tax_treatment: '일반' })
    await request('POST', '/api/account-types', { name: 'CMA', tax_treatment: '일반' })

    const res = await request('GET', '/api/account-types')
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('CMA')
    expect(json.data[1].name).toBe('적금')
  })
})

describe('POST /api/account-types', () => {
  it('creates a type and returns 201', async () => {
    const res = await request('POST', '/api/account-types', {
      name: '일반위탁계좌',
      tax_treatment: '일반',
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('일반위탁계좌')
    expect(json.data.tax_treatment).toBe('일반')
    expect(json.data.id).toBeGreaterThan(0)
  })

  it('defaults tax_treatment to 일반 and short_code to null', async () => {
    const res = await request('POST', '/api/account-types', {
      name: '테스트계좌',
    })
    const json = await res.json()
    expect(json.data.tax_treatment).toBe('일반')
    expect(json.data.short_code).toBeNull()
  })

  it('creates with short_code', async () => {
    const res = await request('POST', '/api/account-types', {
      name: 'ISA (개인종합자산관리계좌)',
      short_code: 'ISA',
      tax_treatment: '세금우대',
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.short_code).toBe('ISA')
  })

  it('returns 400 for empty name', async () => {
    const res = await request('POST', '/api/account-types', { name: '' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('계좌유형명을 입력해주세요.')
  })

  it('returns 400 for missing name', async () => {
    const res = await request('POST', '/api/account-types', { tax_treatment: '일반' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 409 for duplicate name', async () => {
    await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    const res = await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('이미 등록된 계좌유형입니다.')
  })

  it('trims whitespace from name', async () => {
    const res = await request('POST', '/api/account-types', { name: '  적금  ' })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.name).toBe('적금')
  })

  it('returns 400 for invalid tax_treatment', async () => {
    const res = await request('POST', '/api/account-types', {
      name: '테스트',
      tax_treatment: '비과세',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PUT /api/account-types/:id', () => {
  it('updates a type', async () => {
    const createRes = await request('POST', '/api/account-types', {
      name: '일반위탁계좌',
      tax_treatment: '일반',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, {
      name: '해외주식 위탁계좌',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('해외주식 위탁계좌')
  })

  it('returns 400 for empty update body', async () => {
    const createRes = await request('POST', '/api/account-types', {
      name: '일반위탁계좌',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, {})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('최소 하나의 필드를 입력해주세요.')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('PUT', '/api/account-types/999', { name: '없음' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id (NaN)', async () => {
    const res = await request('PUT', '/api/account-types/abc', { name: '없음' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name with different type', async () => {
    await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    const createRes = await request('POST', '/api/account-types', { name: 'CMA' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, { name: '일반위탁계좌' })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('이미 등록된 계좌유형입니다.')
  })

  it('returns 400 for invalid tax_treatment', async () => {
    const createRes = await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, {
      tax_treatment: '비과세',
    })
    expect(res.status).toBe(400)
  })

  it('succeeds when self-updating with same name', async () => {
    const createRes = await request('POST', '/api/account-types', {
      name: '일반위탁계좌',
      tax_treatment: '일반',
    })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, {
      name: '일반위탁계좌',
      tax_treatment: '연금',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.tax_treatment).toBe('연금')
  })

  it('rejects unknown fields with strict schema', async () => {
    const createRes = await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    const { id } = (await createRes.json()).data

    const res = await request('PUT', `/api/account-types/${id}`, {
      name: 'CMA',
      unknownField: 'test',
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/account-types/:id', () => {
  it('deletes a type (200)', async () => {
    const createRes = await request('POST', '/api/account-types', { name: '일반위탁계좌' })
    const { id } = (await createRes.json()).data

    const res = await request('DELETE', `/api/account-types/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/account-types/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('DELETE', '/api/account-types/abc')
    expect(res.status).toBe(400)
  })
})
