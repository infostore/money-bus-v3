// PRD-FEAT-004: Product Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { products } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

const DEFAULT_PRODUCTS: readonly CreateProductPayload[] = [
  // 주식 — 국내
  { name: '삼성전자', code: '005930', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'SK하이닉스', code: '000660', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'LG에너지솔루션', code: '373220', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  // 주식 — 미국
  { name: 'Apple', code: 'AAPL', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'Microsoft', code: 'MSFT', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'NVIDIA', code: 'NVDA', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  // ETF — 국내
  { name: 'KODEX 200', code: '069500', asset_type: 'ETF', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'TIGER 미국S&P500', code: '360750', asset_type: 'ETF', currency: 'KRW', exchange: 'KOSPI' },
  // ETF — 미국
  { name: 'VOO', code: 'VOO', asset_type: 'ETF', currency: 'USD', exchange: 'NYSE' },
  { name: 'QQQ', code: 'QQQ', asset_type: 'ETF', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'SCHD', code: 'SCHD', asset_type: 'ETF', currency: 'USD', exchange: 'NYSE' },
  // 암호화폐
  { name: '비트코인', code: 'BTC', asset_type: '암호화폐', currency: 'KRW', exchange: 'UPBIT' },
  { name: '이더리움', code: 'ETH', asset_type: '암호화폐', currency: 'KRW', exchange: 'UPBIT' },
  // 예적금
  { name: '정기예금', code: null, asset_type: '예적금', currency: 'KRW', exchange: null },
  { name: '정기적금', code: null, asset_type: '예적금', currency: 'KRW', exchange: null },
] as const

export class ProductRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .orderBy(asc(products.name))

    return rows.map(toProduct)
  }

  async findById(id: number): Promise<Product | undefined> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))

    return rows[0] ? toProduct(rows[0]) : undefined
  }

  async create(input: CreateProductPayload): Promise<Product> {
    const rows = await this.db
      .insert(products)
      .values({
        name: input.name,
        code: input.code ?? null,
        assetType: input.asset_type ?? '기타',
        currency: input.currency ?? 'KRW',
        exchange: input.exchange ?? null,
      })
      .returning()

    return toProduct(rows[0])
  }

  async update(
    id: number,
    input: UpdateProductPayload,
  ): Promise<Product | undefined> {
    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.code !== undefined) updates.code = input.code
    if (input.asset_type !== undefined) updates.assetType = input.asset_type
    if (input.currency !== undefined) updates.currency = input.currency
    if (input.exchange !== undefined) updates.exchange = input.exchange

    const rows = await this.db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning()

    return rows[0] ? toProduct(rows[0]) : undefined
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id })

    return rows.length > 0
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(products)

    return result?.value ?? 0
  }

  async seed(): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(products)
        .values(
          DEFAULT_PRODUCTS.map((p) => ({
            name: p.name,
            code: p.code ?? null,
            assetType: p.asset_type ?? '기타',
            currency: p.currency ?? 'KRW',
            exchange: p.exchange ?? null,
          })),
        )
        .onConflictDoNothing()
    })
  }
}

function toProduct(
  row: typeof products.$inferSelect,
): Product {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    asset_type: row.assetType,
    currency: row.currency,
    exchange: row.exchange,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
