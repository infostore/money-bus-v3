// PRD-FEAT-004: Product Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { products } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  Product,
  UpdateProductPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

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
