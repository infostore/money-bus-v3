// PRD-FEAT-010: Account Management - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { AccountRepository } from '../../src/server/database/account-repository.js'
import { createAccountRoutes } from '../../src/server/routes/accounts.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono

let memberId: number
let institutionId: number
let accountTypeId: number

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  const repo = new AccountRepository(db)
  app = new Hono()
  app.route('/api/accounts', createAccountRoutes(repo))

  // Clean FK tables before inserting test data
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`)

  // Create FK reference rows
  const [member] = await db
    .insert(schema.familyMembers)
    .values({ name: '테스트유저', relationship: '본인' })
    .returning()
  memberId = member.id

  const [inst] = await db
    .insert(schema.institutions)
    .values({ name: '테스트증권', category: '증권' })
    .returning()
  institutionId = inst.id

  const [accType] = await db
    .insert(schema.accountTypes)
    .values({ name: '테스트유형', shortCode: 'TEST', taxTreatment: '일반' })
    .returning()
  accountTypeId = accType.id
})

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`)
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
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

function validPayload(overrides?: Record<string, unknown>) {
  return {
    account_name: '테스트 계좌',
    family_member_id: memberId,
    institution_id: institutionId,
    account_type_id: accountTypeId,
    ...overrides,
  }
}

describe('GET /api/accounts', () => {
  it('returns empty array when no accounts exist', async () => {
    const res = await request('GET', '/api/accounts')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns accounts with joined details', async () => {
    await request('POST', '/api/accounts', validPayload())
    const res = await request('GET', '/api/accounts')
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].account_name).toBe('테스트 계좌')
    expect(json.data[0].family_member_name).toBe('테스트유저')
    expect(json.data[0].institution_name).toBe('테스트증권')
    expect(json.data[0].account_type_name).toBe('테스트유형')
  })
})

describe('POST /api/accounts', () => {
  it('creates an account and returns 201', async () => {
    const res = await request('POST', '/api/accounts', validPayload())
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.account_name).toBe('테스트 계좌')
    expect(json.data.family_member_name).toBe('테스트유저')
  })

  it('creates an account with account_number', async () => {
    const res = await request('POST', '/api/accounts', validPayload({
      account_number: '123-456-789',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.account_number).toBe('123-456-789')
  })

  it('returns 400 for missing account_name', async () => {
    const res = await request('POST', '/api/accounts', {
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing FK fields', async () => {
    const res = await request('POST', '/api/accounts', {
      account_name: '계좌',
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate account_name', async () => {
    await request('POST', '/api/accounts', validPayload())
    const res = await request('POST', '/api/accounts', validPayload())
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('이미 등록된 계좌입니다.')
  })

  it('returns 400 for invalid FK reference', async () => {
    const res = await request('POST', '/api/accounts', validPayload({
      family_member_id: 9999,
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('유효하지 않은')
  })
})

describe('PUT /api/accounts/:id', () => {
  it('updates account_name', async () => {
    const createRes = await request('POST', '/api/accounts', validPayload())
    const { data: created } = await createRes.json()

    const res = await request('PUT', `/api/accounts/${created.id}`, {
      account_name: '수정된 계좌',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.account_name).toBe('수정된 계좌')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('PUT', '/api/accounts/999', {
      account_name: '없는 계좌',
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for empty body', async () => {
    const createRes = await request('POST', '/api/accounts', validPayload())
    const { data: created } = await createRes.json()

    const res = await request('PUT', `/api/accounts/${created.id}`, {})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('최소 하나의 필드')
  })

  it('returns 409 for duplicate account_name', async () => {
    await request('POST', '/api/accounts', validPayload())
    const createRes = await request('POST', '/api/accounts', validPayload({
      account_name: '다른 계좌',
    }))
    const { data: created } = await createRes.json()

    const res = await request('PUT', `/api/accounts/${created.id}`, {
      account_name: '테스트 계좌',
    })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/accounts/:id', () => {
  it('deletes an existing account', async () => {
    const createRes = await request('POST', '/api/accounts', validPayload())
    const { data: created } = await createRes.json()

    const res = await request('DELETE', `/api/accounts/${created.id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/accounts/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('DELETE', '/api/accounts/abc')
    expect(res.status).toBe(400)
  })
})
