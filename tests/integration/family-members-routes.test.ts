// PRD-FEAT-001: Family Member Management - Route Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as schema from '../../src/server/database/schema.js'
import { FamilyMemberRepository } from '../../src/server/database/family-member-repository.js'
import { createFamilyMemberRoutes } from '../../src/server/routes/family-members.js'

const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let app: Hono

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  const repo = new FamilyMemberRepository(db)
  app = new Hono()
  app.route('/api/family-members', createFamilyMemberRoutes(repo))
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`,
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

describe('GET /api/family-members', () => {
  it('returns empty array when no members exist', async () => {
    const res = await request('GET', '/api/family-members')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns all members sorted by id', async () => {
    await request('POST', '/api/family-members', {
      name: '홍길동',
      relationship: '본인',
    })
    await request('POST', '/api/family-members', {
      name: '홍길순',
      relationship: '배우자',
    })

    const res = await request('GET', '/api/family-members')
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].name).toBe('홍길동')
    expect(json.data[1].name).toBe('홍길순')
  })
})

describe('POST /api/family-members', () => {
  it('creates a member and returns 201', async () => {
    const res = await request('POST', '/api/family-members', {
      name: '홍길동',
      relationship: '본인',
      birth_year: 1990,
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('홍길동')
    expect(json.data.relationship).toBe('본인')
    expect(json.data.birth_year).toBe(1990)
    expect(json.data.id).toBeGreaterThan(0)
  })

  it('returns 400 for invalid input', async () => {
    const res = await request('POST', '/api/family-members', {
      name: '',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 for missing name', async () => {
    const res = await request('POST', '/api/family-members', {
      relationship: '본인',
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name', async () => {
    await request('POST', '/api/family-members', { name: '홍길동' })
    const res = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('already exists')
  })

  it('trims whitespace from name', async () => {
    const res = await request('POST', '/api/family-members', {
      name: '  홍길동  ',
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.name).toBe('홍길동')
  })

  it('defaults relationship to 본인', async () => {
    const res = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    const json = await res.json()
    expect(json.data.relationship).toBe('본인')
  })
})

describe('PUT /api/family-members/:id', () => {
  it('updates a member', async () => {
    const createRes = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    const { id } = (await createRes.json()).data

    const res = await request(`PUT`, `/api/family-members/${id}`, {
      name: '홍길순',
      relationship: '배우자',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.name).toBe('홍길순')
    expect(json.data.relationship).toBe('배우자')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('PUT', '/api/family-members/999', {
      name: '없음',
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('PUT', '/api/family-members/abc', {
      name: '없음',
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate name with different member', async () => {
    await request('POST', '/api/family-members', { name: '홍길동' })
    const createRes = await request('POST', '/api/family-members', {
      name: '홍길순',
    })
    const { id } = (await createRes.json()).data

    const res = await request(`PUT`, `/api/family-members/${id}`, {
      name: '홍길동',
    })
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid update payload', async () => {
    const createRes = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    const { id } = (await createRes.json()).data

    const res = await request(`PUT`, `/api/family-members/${id}`, {
      birth_year: 'not-a-number',
    })
    expect(res.status).toBe(400)
  })

  it('succeeds when self-updating with same name', async () => {
    const createRes = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    const { id } = (await createRes.json()).data

    const res = await request(`PUT`, `/api/family-members/${id}`, {
      name: '홍길동',
      birth_year: 1990,
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.birth_year).toBe(1990)
  })
})

describe('DELETE /api/family-members/:id', () => {
  it('deletes a member', async () => {
    const createRes = await request('POST', '/api/family-members', {
      name: '홍길동',
    })
    const { id } = (await createRes.json()).data

    const res = await request('DELETE', `/api/family-members/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request('DELETE', '/api/family-members/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request('DELETE', '/api/family-members/abc')
    expect(res.status).toBe(400)
  })
})
