import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ItemRepository, SettingsRepository } from '../../src/server/database/repositories.js'

const TEST_DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let itemRepo: ItemRepository
let settingsRepo: SettingsRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  itemRepo = new ItemRepository(db)
  settingsRepo = new SettingsRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE items RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE settings`)
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
