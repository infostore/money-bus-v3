import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ItemRepository, SettingsRepository } from '../../src/server/database/repositories.js'
import { FamilyMemberRepository } from '../../src/server/database/family-member-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let itemRepo: ItemRepository
let settingsRepo: SettingsRepository
let familyMemberRepo: FamilyMemberRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  itemRepo = new ItemRepository(db)
  settingsRepo = new SettingsRepository(db)
  familyMemberRepo = new FamilyMemberRepository(db)

  // Clean slate for all tables before tests start
  await db.execute(sql`TRUNCATE TABLE items RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE settings`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE items RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE settings`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
})

describe('ItemRepository', () => {
  it('creates and retrieves an item', async () => {
    const created = await itemRepo.create({ name: 'Widget', value: 9.99 })
    expect(created.name).toBe('Widget')
    expect(created.value).toBe(9.99)
    expect(created.category).toBe('general')
    expect(created.id).toBeGreaterThan(0)

    const found = await itemRepo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Widget')
  })

  it('returns undefined for non-existent id', async () => {
    const found = await itemRepo.findById(999)
    expect(found).toBeUndefined()
  })

  it('lists all items ordered by created_at desc', async () => {
    await itemRepo.create({ name: 'A', value: 1 })
    await itemRepo.create({ name: 'B', value: 2 })

    const all = await itemRepo.findAll()
    expect(all).toHaveLength(2)
    expect(all[0].name).toBe('B')
  })

  it('deletes an item', async () => {
    const created = await itemRepo.create({ name: 'ToDelete', value: 0 })
    const deleted = await itemRepo.delete(created.id)
    expect(deleted).toBe(true)

    const found = await itemRepo.findById(created.id)
    expect(found).toBeUndefined()
  })

  it('returns false when deleting non-existent item', async () => {
    const deleted = await itemRepo.delete(999)
    expect(deleted).toBe(false)
  })

  it('returns correct summary', async () => {
    await itemRepo.create({ name: 'A', value: 10, category: 'electronics' })
    await itemRepo.create({ name: 'B', value: 20, category: 'books' })
    await itemRepo.create({ name: 'C', value: 30, category: 'electronics' })

    const summary = await itemRepo.getSummary()
    expect(summary.total).toBe(3)
    expect(summary.totalValue).toBe(60)
    expect(summary.categories).toContain('electronics')
    expect(summary.categories).toContain('books')
  })
})

describe('SettingsRepository', () => {
  it('sets and gets a value', async () => {
    await settingsRepo.set('theme', 'dark')
    const value = await settingsRepo.get('theme')
    expect(value).toBe('dark')
  })

  it('returns undefined for non-existent key', async () => {
    const value = await settingsRepo.get('nonexistent')
    expect(value).toBeUndefined()
  })

  it('overwrites existing key', async () => {
    await settingsRepo.set('lang', 'en')
    await settingsRepo.set('lang', 'ko')
    const value = await settingsRepo.get('lang')
    expect(value).toBe('ko')
  })

  it('returns all settings', async () => {
    await settingsRepo.set('a', '1')
    await settingsRepo.set('b', '2')

    const all = await settingsRepo.getAll()
    expect(all).toEqual({ a: '1', b: '2' })
  })
})

describe('FamilyMemberRepository', () => {
  it('findAll returns empty array initially', async () => {
    const all = await familyMemberRepo.findAll()
    expect(all).toEqual([])
  })

  it('creates and retrieves a member by id', async () => {
    const created = await familyMemberRepo.create({ name: '홍길동', relationship: '본인' })
    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('홍길동')
    expect(created.relationship).toBe('본인')
    expect(created.birth_year).toBeNull()

    const found = await familyMemberRepo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('홍길동')
  })

  it('findAll returns members sorted by id ASC', async () => {
    await familyMemberRepo.create({ name: '홍길동', relationship: '본인' })
    await familyMemberRepo.create({ name: '홍길순', relationship: '배우자' })

    const all = await familyMemberRepo.findAll()
    expect(all).toHaveLength(2)
    expect(all[0].name).toBe('홍길동')
    expect(all[1].name).toBe('홍길순')
  })

  it('updates existing member with partial fields', async () => {
    const created = await familyMemberRepo.create({ name: '홍길동', relationship: '본인' })
    const updated = await familyMemberRepo.update(created.id, { birth_year: 1990 })

    expect(updated).toBeDefined()
    expect(updated!.name).toBe('홍길동')
    expect(updated!.birth_year).toBe(1990)
    expect(updated!.relationship).toBe('본인')
  })

  it('update sets updated_at timestamp', async () => {
    const created = await familyMemberRepo.create({ name: '홍길동' })
    const originalUpdatedAt = created.updated_at

    await new Promise((resolve) => setTimeout(resolve, 10))
    const updated = await familyMemberRepo.update(created.id, { name: '홍길순' })

    expect(updated).toBeDefined()
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(originalUpdatedAt).getTime(),
    )
  })

  it('update returns undefined for non-existent id', async () => {
    const result = await familyMemberRepo.update(999, { name: '없음' })
    expect(result).toBeUndefined()
  })

  it('deletes existing member', async () => {
    const created = await familyMemberRepo.create({ name: '홍길동' })
    const deleted = await familyMemberRepo.delete(created.id)
    expect(deleted).toBe(true)

    const found = await familyMemberRepo.findById(created.id)
    expect(found).toBeUndefined()
  })

  it('delete returns false for non-existent id', async () => {
    const deleted = await familyMemberRepo.delete(999)
    expect(deleted).toBe(false)
  })

  it('create with duplicate name throws unique constraint error', async () => {
    await familyMemberRepo.create({ name: '홍길동' })
    await expect(familyMemberRepo.create({ name: '홍길동' })).rejects.toThrow()
  })
})
