// PRD-FEAT-010: Account Management - Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { AccountRepository } from '../../src/server/database/account-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let repo: AccountRepository

// FK reference IDs created in beforeAll
let memberId: number
let institutionId: number
let accountTypeId: number
let memberId2: number
let institutionId2: number

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new AccountRepository(db)

  // Clean FK tables before inserting test data
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`)

  // Create FK reference rows
  const [member] = await db
    .insert(schema.familyMembers)
    .values({ name: '홍길동', relationship: '본인' })
    .returning()
  memberId = member.id

  const [member2] = await db
    .insert(schema.familyMembers)
    .values({ name: '김영희', relationship: '배우자' })
    .returning()
  memberId2 = member2.id

  const [inst] = await db
    .insert(schema.institutions)
    .values({ name: '삼성증권', category: '증권' })
    .returning()
  institutionId = inst.id

  const [inst2] = await db
    .insert(schema.institutions)
    .values({ name: '미래에셋증권', category: '증권' })
    .returning()
  institutionId2 = inst2.id

  const [accType] = await db
    .insert(schema.accountTypes)
    .values({ name: 'ISA', shortCode: 'ISA', taxTreatment: '세금우대' })
    .returning()
  accountTypeId = accType.id
})

afterAll(async () => {
  // Clean up in reverse FK order
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE family_members RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE institutions RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE account_types RESTART IDENTITY CASCADE`)
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE accounts RESTART IDENTITY CASCADE`)
})

describe('AccountRepository.findAll', () => {
  it('returns empty array when no accounts exist', async () => {
    const result = await repo.findAll()
    expect(result).toEqual([])
  })

  it('returns all accounts with joined details sorted by account_name ASC', async () => {
    await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })
    await repo.create({
      account_name: '미래에셋 ISA',
      family_member_id: memberId2,
      institution_id: institutionId2,
      account_type_id: accountTypeId,
    })

    const result = await repo.findAll()
    expect(result).toHaveLength(2)
    expect(result[0].account_name).toBe('미래에셋 ISA')
    expect(result[0].family_member_name).toBe('김영희')
    expect(result[0].institution_name).toBe('미래에셋증권')
    expect(result[0].account_type_name).toBe('ISA')
    expect(result[1].account_name).toBe('삼성증권 ISA')
    expect(result[1].family_member_name).toBe('홍길동')
  })
})

describe('AccountRepository.create', () => {
  it('creates an account with required fields', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    expect(created.id).toBeGreaterThan(0)
    expect(created.account_name).toBe('삼성증권 ISA')
    expect(created.account_number).toBeNull()
    expect(created.family_member_id).toBe(memberId)
    expect(created.family_member_name).toBe('홍길동')
    expect(created.institution_id).toBe(institutionId)
    expect(created.institution_name).toBe('삼성증권')
    expect(created.account_type_id).toBe(accountTypeId)
    expect(created.account_type_name).toBe('ISA')
    expect(created.created_at).toBeDefined()
    expect(created.updated_at).toBeDefined()
  })

  it('creates an account with account_number', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      account_number: '123-456-789012',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    expect(created.account_number).toBe('123-456-789012')
  })

  it('throws on duplicate account_name', async () => {
    await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })
    await expect(
      repo.create({
        account_name: '삼성증권 ISA',
        family_member_id: memberId,
        institution_id: institutionId,
        account_type_id: accountTypeId,
      }),
    ).rejects.toThrow()
  })

  it('throws on invalid FK reference', async () => {
    await expect(
      repo.create({
        account_name: '잘못된 계좌',
        family_member_id: 9999,
        institution_id: institutionId,
        account_type_id: accountTypeId,
      }),
    ).rejects.toThrow()
  })
})

describe('AccountRepository.findById', () => {
  it('returns the account with details for a valid id', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      account_number: '123-456-789012',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    const found = await repo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.account_name).toBe('삼성증권 ISA')
    expect(found!.family_member_name).toBe('홍길동')
    expect(found!.institution_name).toBe('삼성증권')
    expect(found!.account_type_name).toBe('ISA')
  })

  it('returns undefined for non-existent id', async () => {
    const found = await repo.findById(999)
    expect(found).toBeUndefined()
  })
})

describe('AccountRepository.update', () => {
  it('updates account_name', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    const updated = await repo.update(created.id, { account_name: '삼성증권 일반' })
    expect(updated).toBeDefined()
    expect(updated!.account_name).toBe('삼성증권 일반')
    expect(updated!.family_member_name).toBe('홍길동')
  })

  it('updates FK references', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    const updated = await repo.update(created.id, {
      family_member_id: memberId2,
      institution_id: institutionId2,
    })
    expect(updated!.family_member_name).toBe('김영희')
    expect(updated!.institution_name).toBe('미래에셋증권')
  })

  it('updates account_number to null', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      account_number: '123-456',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    const updated = await repo.update(created.id, { account_number: null })
    expect(updated!.account_number).toBeNull()
  })

  it('sets updatedAt on update', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const updated = await repo.update(created.id, { account_name: '수정 계좌' })
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(created.updated_at).getTime(),
    )
  })

  it('returns undefined for non-existent id', async () => {
    const updated = await repo.update(999, { account_name: '없음' })
    expect(updated).toBeUndefined()
  })
})

describe('AccountRepository.delete', () => {
  it('deletes an existing account and returns true', async () => {
    const created = await repo.create({
      account_name: '삼성증권 ISA',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })

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

describe('AccountRepository.count', () => {
  it('returns 0 when no accounts exist', async () => {
    const c = await repo.count()
    expect(c).toBe(0)
  })

  it('returns correct count after creating accounts', async () => {
    await repo.create({
      account_name: '계좌 1',
      family_member_id: memberId,
      institution_id: institutionId,
      account_type_id: accountTypeId,
    })
    await repo.create({
      account_name: '계좌 2',
      family_member_id: memberId2,
      institution_id: institutionId2,
      account_type_id: accountTypeId,
    })

    const c = await repo.count()
    expect(c).toBe(2)
  })
})
