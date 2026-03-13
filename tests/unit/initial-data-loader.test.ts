// PRD-FEAT-006: Initial Data Bidirectional Sync
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'node:fs'
import * as schema from '../../src/server/database/schema.js'
import { syncInitialData } from '../../src/server/database/initial-data-loader.js'
import { TEST_DATABASE_URL } from '../integration/test-database.js'

const TEST_SQLITE_PATH = '/tmp/test-initial-data.db'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>

function createTestSqlite(): InstanceType<typeof Database> {
  if (existsSync(TEST_SQLITE_PATH)) unlinkSync(TEST_SQLITE_PATH)
  const slDb = new Database(TEST_SQLITE_PATH)
  slDb.pragma('journal_mode = WAL')
  slDb.prepare(`CREATE TABLE family_members (
    name TEXT PRIMARY KEY, relationship TEXT NOT NULL DEFAULT '본인',
    birth_year INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run()
  slDb.prepare(`CREATE TABLE institutions (
    name TEXT PRIMARY KEY, category TEXT NOT NULL DEFAULT '증권',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run()
  slDb.prepare(`CREATE TABLE account_types (
    name TEXT PRIMARY KEY, short_code TEXT, tax_treatment TEXT NOT NULL DEFAULT '일반',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run()
  slDb.prepare(`CREATE TABLE accounts (
    account_name TEXT PRIMARY KEY, account_number TEXT,
    family_member_id INTEGER NOT NULL, institution_id INTEGER NOT NULL,
    account_type_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run()
  slDb.prepare(`CREATE TABLE products (
    name TEXT PRIMARY KEY, code TEXT, asset_type TEXT NOT NULL DEFAULT '기타',
    currency TEXT NOT NULL DEFAULT 'KRW', exchange TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run()
  return slDb
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
})

afterAll(async () => {
  await pool.end()
  if (existsSync(TEST_SQLITE_PATH)) unlinkSync(TEST_SQLITE_PATH)
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`)
})

describe('syncInitialData', () => {
  it('inserts SQLite records into empty PG', async () => {
    const slDb = createTestSqlite()
    slDb.prepare(
      'INSERT INTO institutions (name, category, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('테스트증권', '증권', '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    slDb.close()

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.institutions.pgInserted).toBe(1)
    expect(result.institutions.sqliteInserted).toBe(0)

    const rows = await db.select().from(schema.institutions)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('테스트증권')
  })

  it('inserts PG records into SQLite', async () => {
    const slDb = createTestSqlite()
    slDb.close()

    await db.insert(schema.institutions).values({
      name: 'PG증권',
      category: '증권',
    })

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.institutions.sqliteInserted).toBe(1)
    expect(result.institutions.pgInserted).toBe(0)

    const slDb2 = new Database(TEST_SQLITE_PATH)
    const rows = slDb2.prepare('SELECT * FROM institutions').all() as { name: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('PG증권')
    slDb2.close()
  })

  it('updates PG when SQLite has newer timestamp', async () => {
    // Insert into PG with older timestamp
    await db.insert(schema.institutions).values({
      name: '동기화증권',
      category: '증권',
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-01T00:00:00Z'),
    })

    // Insert into SQLite with newer timestamp
    const slDb = createTestSqlite()
    slDb.prepare(
      'INSERT INTO institutions (name, category, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('동기화증권', '은행', '2026-03-01T00:00:00Z', '2026-03-10T00:00:00Z')
    slDb.close()

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.institutions.pgUpdated).toBe(1)

    const rows = await db.select().from(schema.institutions)
    expect(rows[0].category).toBe('은행')
  })

  it('updates SQLite when PG has newer timestamp', async () => {
    // Insert into PG with newer timestamp
    await db.insert(schema.institutions).values({
      name: '역동기화증권',
      category: '은행',
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-10T00:00:00Z'),
    })

    // Insert into SQLite with older timestamp
    const slDb = createTestSqlite()
    slDb.prepare(
      'INSERT INTO institutions (name, category, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('역동기화증권', '증권', '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    slDb.close()

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.institutions.sqliteUpdated).toBe(1)

    const slDb2 = new Database(TEST_SQLITE_PATH)
    const row = slDb2.prepare('SELECT * FROM institutions WHERE name = ?').get('역동기화증권') as { category: string }
    expect(row.category).toBe('은행')
    slDb2.close()
  })

  it('skips when timestamps are equal', async () => {
    await db.insert(schema.institutions).values({
      name: '동일증권',
      category: '증권',
      createdAt: new Date('2026-03-05T00:00:00Z'),
      updatedAt: new Date('2026-03-05T00:00:00Z'),
    })

    const slDb = createTestSqlite()
    slDb.prepare(
      'INSERT INTO institutions (name, category, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('동일증권', '은행', '2026-03-05T00:00:00Z', '2026-03-05T00:00:00Z')
    slDb.close()

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.institutions.pgUpdated).toBe(0)
    expect(result.institutions.sqliteUpdated).toBe(0)
  })

  it('syncs products bidirectionally', async () => {
    const slDb = createTestSqlite()
    slDb.prepare(
      'INSERT INTO products (name, code, asset_type, currency, exchange, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('테스트주식', 'TEST', '주식', 'KRW', 'KOSPI', '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')
    slDb.close()

    await db.insert(schema.products).values({
      name: 'PG주식',
      code: 'PG01',
      assetType: 'ETF',
      currency: 'USD',
      exchange: 'NYSE',
    })

    const result = await syncInitialData(db, TEST_SQLITE_PATH)

    expect(result.products.pgInserted).toBe(1)
    expect(result.products.sqliteInserted).toBe(1)

    const pgRows = await db.select().from(schema.products)
    expect(pgRows).toHaveLength(2)

    const slDb2 = new Database(TEST_SQLITE_PATH)
    const slRows = slDb2.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
    expect(slRows.c).toBe(2)
    slDb2.close()
  })

  it('returns empty result when sqlite file not found', async () => {
    const result = await syncInitialData(db, '/tmp/nonexistent.db')

    expect(result.institutions.pgInserted).toBe(0)
    expect(result.products.pgInserted).toBe(0)
  })
})
