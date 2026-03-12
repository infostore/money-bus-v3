// PRD-FEAT-004: Product Management - Repository Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { ProductRepository } from '../../src/server/database/product-repository.js'

const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app'

let pool: pg.Pool
let db: ReturnType<typeof drizzle>
let repo: ProductRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new ProductRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`,
  )
})

describe('ProductRepository.findAll', () => {
  it('returns empty array when no products exist', async () => {
    const result = await repo.findAll()
    expect(result).toEqual([])
  })

  it('returns all products sorted by name ASC', async () => {
    await repo.create({ name: '비트코인', code: 'BTC', asset_type: '암호화폐' })
    await repo.create({ name: 'Apple', code: 'AAPL', asset_type: '주식' })
    await repo.create({ name: '삼성전자', code: '005930', asset_type: '주식' })

    const result = await repo.findAll()
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Apple')
    expect(result[1].name).toBe('비트코인')
    expect(result[2].name).toBe('삼성전자')
  })
})

describe('ProductRepository.create', () => {
  it('creates a product with defaults', async () => {
    const created = await repo.create({ name: '삼성전자' })

    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('삼성전자')
    expect(created.code).toBeNull()
    expect(created.asset_type).toBe('기타')
    expect(created.currency).toBe('KRW')
    expect(created.exchange).toBeNull()
    expect(created.created_at).toBeDefined()
    expect(created.updated_at).toBeDefined()
  })

  it('creates a product with all fields', async () => {
    const created = await repo.create({
      name: 'Apple',
      code: 'AAPL',
      asset_type: '주식',
      currency: 'USD',
      exchange: 'NASDAQ',
    })

    expect(created.name).toBe('Apple')
    expect(created.code).toBe('AAPL')
    expect(created.asset_type).toBe('주식')
    expect(created.currency).toBe('USD')
    expect(created.exchange).toBe('NASDAQ')
  })

  it('throws on duplicate name', async () => {
    await repo.create({ name: '삼성전자' })
    await expect(repo.create({ name: '삼성전자' })).rejects.toThrow()
  })
})

describe('ProductRepository.findById', () => {
  it('returns the product for a valid id', async () => {
    const created = await repo.create({
      name: 'Apple',
      code: 'AAPL',
      asset_type: '주식',
      currency: 'USD',
      exchange: 'NASDAQ',
    })

    const found = await repo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.name).toBe('Apple')
    expect(found!.asset_type).toBe('주식')
  })

  it('returns undefined for non-existent id', async () => {
    const found = await repo.findById(999)
    expect(found).toBeUndefined()
  })
})

describe('ProductRepository.update', () => {
  it('updates name and asset_type of a product', async () => {
    const created = await repo.create({ name: '테스트종목', asset_type: '기타' })

    const updated = await repo.update(created.id, { name: '수정종목', asset_type: '주식' })
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('수정종목')
    expect(updated!.asset_type).toBe('주식')
  })

  it('updates only name when other fields are not provided', async () => {
    const created = await repo.create({
      name: 'Apple',
      code: 'AAPL',
      asset_type: '주식',
      currency: 'USD',
      exchange: 'NASDAQ',
    })

    const updated = await repo.update(created.id, { name: 'Apple Inc.' })
    expect(updated!.name).toBe('Apple Inc.')
    expect(updated!.code).toBe('AAPL')
    expect(updated!.asset_type).toBe('주식')
    expect(updated!.currency).toBe('USD')
    expect(updated!.exchange).toBe('NASDAQ')
  })

  it('updates code to null', async () => {
    const created = await repo.create({ name: 'Apple', code: 'AAPL' })

    const updated = await repo.update(created.id, { code: null })
    expect(updated!.code).toBeNull()
  })

  it('updates exchange to null', async () => {
    const created = await repo.create({ name: 'Apple', exchange: 'NASDAQ' })

    const updated = await repo.update(created.id, { exchange: null })
    expect(updated!.exchange).toBeNull()
  })

  it('sets updatedAt on update', async () => {
    const created = await repo.create({ name: 'Apple' })

    const updated = await repo.update(created.id, { name: 'Apple Inc.' })
    expect(updated!.updated_at).not.toBe(created.updated_at)
  })

  it('returns undefined for non-existent id', async () => {
    const updated = await repo.update(999, { name: '없음' })
    expect(updated).toBeUndefined()
  })
})

describe('ProductRepository.delete', () => {
  it('deletes an existing product and returns true', async () => {
    const created = await repo.create({ name: 'Apple' })

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

describe('ProductRepository.count', () => {
  it('returns 0 when no products exist', async () => {
    const c = await repo.count()
    expect(c).toBe(0)
  })

  it('returns correct count after creating products', async () => {
    await repo.create({ name: 'Apple' })
    await repo.create({ name: '삼성전자' })

    const c = await repo.count()
    expect(c).toBe(2)
  })
})

describe('ProductRepository.seed', () => {
  it('seeds 15 default products', async () => {
    await repo.seed()
    const all = await repo.findAll()
    expect(all).toHaveLength(15)
  })

  it('count returns 15 after seed', async () => {
    expect(await repo.count()).toBe(0)
    await repo.seed()
    expect(await repo.count()).toBe(15)
  })

  it('seed is idempotent — calling twice still results in 15 records', async () => {
    await repo.seed()
    await repo.seed()
    const all = await repo.findAll()
    expect(all).toHaveLength(15)
  })

  it('seed includes stocks, ETFs, crypto, and deposits', async () => {
    await repo.seed()
    const all = await repo.findAll()

    const stocks = all.filter((p) => p.asset_type === '주식')
    const etfs = all.filter((p) => p.asset_type === 'ETF')
    const crypto = all.filter((p) => p.asset_type === '암호화폐')
    const deposits = all.filter((p) => p.asset_type === '예적금')

    expect(stocks).toHaveLength(6)
    expect(etfs).toHaveLength(5)
    expect(crypto).toHaveLength(2)
    expect(deposits).toHaveLength(2)
  })

  it('seed includes products with null code and exchange', async () => {
    await repo.seed()
    const all = await repo.findAll()

    const deposit = all.find((p) => p.name === '정기예금')
    expect(deposit?.code).toBeNull()
    expect(deposit?.exchange).toBeNull()
  })
})
