// PRD-FEAT-003: Account Type Management - Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { AccountTypeRepository } from '../../src/server/database/account-type-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let repo: AccountTypeRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new AccountTypeRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`,
  )
})

describe('AccountTypeRepository.findAll', () => {
  it('returns empty array when no account types exist', async () => {
    const result = await repo.findAll()
    expect(result).toEqual([])
  })

  it('returns all account types sorted by name ASC', async () => {
    await repo.create({ name: '퇴직연금 DB' })
    await repo.create({ name: 'CMA' })
    await repo.create({ name: '연금저축계좌' })

    const result = await repo.findAll()
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('CMA')
    expect(result[1].name).toBe('연금저축계좌')
    expect(result[2].name).toBe('퇴직연금 DB')
  })
})

describe('AccountTypeRepository.create', () => {
  it('creates an account type with default tax treatment and null short_code', async () => {
    const created = await repo.create({ name: '일반위탁계좌' })

    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('일반위탁계좌')
    expect(created.short_code).toBeNull()
    expect(created.tax_treatment).toBe('일반')
    expect(created.created_at).toBeDefined()
    expect(created.updated_at).toBeDefined()
  })

  it('creates an account type with short_code', async () => {
    const created = await repo.create({ name: 'ISA (개인종합자산관리계좌)', short_code: 'ISA', tax_treatment: '세금우대' })

    expect(created.name).toBe('ISA (개인종합자산관리계좌)')
    expect(created.short_code).toBe('ISA')
    expect(created.tax_treatment).toBe('세금우대')
  })

  it('creates an account type with explicit tax treatment', async () => {
    const created = await repo.create({ name: '연금저축계좌', tax_treatment: '연금' })

    expect(created.name).toBe('연금저축계좌')
    expect(created.tax_treatment).toBe('연금')
  })
})

describe('AccountTypeRepository.findById', () => {
  it('returns the account type for a valid id', async () => {
    const created = await repo.create({ name: 'ISA (개인종합자산관리계좌)', tax_treatment: '세금우대' })

    const found = await repo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.name).toBe('ISA (개인종합자산관리계좌)')
    expect(found!.tax_treatment).toBe('세금우대')
  })

  it('returns undefined for non-existent id', async () => {
    const found = await repo.findById(999)
    expect(found).toBeUndefined()
  })
})

describe('AccountTypeRepository.update', () => {
  it('updates name and tax_treatment of an account type', async () => {
    const created = await repo.create({ name: '예금', tax_treatment: '일반' })

    const updated = await repo.update(created.id, { name: '적금', tax_treatment: '세금우대' })
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('적금')
    expect(updated!.tax_treatment).toBe('세금우대')
  })

  it('updates only name when tax_treatment is not provided', async () => {
    const created = await repo.create({ name: '예금', tax_treatment: '연금' })

    const updated = await repo.update(created.id, { name: '적금' })
    expect(updated!.name).toBe('적금')
    expect(updated!.tax_treatment).toBe('연금')
  })

  it('updates short_code', async () => {
    const created = await repo.create({ name: 'ISA (개인종합자산관리계좌)', short_code: 'ISA' })

    const updated = await repo.update(created.id, { short_code: 'ISA계좌' })
    expect(updated!.short_code).toBe('ISA계좌')
    expect(updated!.name).toBe('ISA (개인종합자산관리계좌)')
  })

  it('sets short_code to null', async () => {
    const created = await repo.create({ name: 'CMA', short_code: 'CMA' })

    const updated = await repo.update(created.id, { short_code: null })
    expect(updated!.short_code).toBeNull()
  })

  it('returns undefined for non-existent id', async () => {
    const updated = await repo.update(999, { name: '없음' })
    expect(updated).toBeUndefined()
  })
})

describe('AccountTypeRepository.delete', () => {
  it('deletes an existing account type and returns true', async () => {
    const created = await repo.create({ name: 'CMA' })

    const deleted = await repo.delete(created.id)
    expect(deleted).toBe(true)

    const found = await repo.findById(created.id)
    expect(found).toBeUndefined()
  })

  it('returns false for non-existent id', async () => {
    const deleted = await repo.delete(999)
    expect(deleted).toBe(false)
  })
})

describe('AccountTypeRepository.count', () => {
  it('returns 0 when no account types exist', async () => {
    const c = await repo.count()
    expect(c).toBe(0)
  })

  it('returns correct count after creating account types', async () => {
    await repo.create({ name: 'CMA' })
    await repo.create({ name: '예금' })

    const c = await repo.count()
    expect(c).toBe(2)
  })
})

describe('AccountTypeRepository.seed', () => {
  it('seeds 13 default account types', async () => {
    await repo.seed()
    const all = await repo.findAll()
    expect(all).toHaveLength(13)
  })

  it('count returns 13 after seed', async () => {
    expect(await repo.count()).toBe(0)
    await repo.seed()
    expect(await repo.count()).toBe(13)
  })

  it('seed is idempotent — calling twice still results in 13 records', async () => {
    await repo.seed()
    await repo.seed()
    const all = await repo.findAll()
    expect(all).toHaveLength(13)
  })

  it('seed includes short codes for applicable types', async () => {
    await repo.seed()
    const all = await repo.findAll()

    const isa = all.find((t) => t.name.startsWith('ISA'))
    expect(isa?.short_code).toBe('ISA')

    const irp = all.find((t) => t.name.startsWith('IRP'))
    expect(irp?.short_code).toBe('IRP')

    const savings = all.find((t) => t.name === '예금')
    expect(savings?.short_code).toBeNull()
  })

  it('seed includes tax-advantaged, general, and pension types', async () => {
    await repo.seed()
    const all = await repo.findAll()

    const taxAdvantaged = all.filter((t) => t.tax_treatment === '세금우대')
    const general = all.filter((t) => t.tax_treatment === '일반')
    const pension = all.filter((t) => t.tax_treatment === '연금')

    expect(taxAdvantaged).toHaveLength(4)
    expect(general).toHaveLength(5)
    expect(pension).toHaveLength(4)
  })
})
