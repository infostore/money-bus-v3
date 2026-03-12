import { eq, count, sum, asc, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { items, settings } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { ItemData, CreateItemPayload, ItemSummary } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class ItemRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly ItemData[]> {
    const rows = await this.db
      .select()
      .from(items)
      .orderBy(desc(items.createdAt), desc(items.id))

    return rows.map(toItemData)
  }

  async findById(id: number): Promise<ItemData | undefined> {
    const rows = await this.db
      .select()
      .from(items)
      .where(eq(items.id, id))

    return rows[0] ? toItemData(rows[0]) : undefined
  }

  async create(input: CreateItemPayload): Promise<ItemData> {
    const rows = await this.db
      .insert(items)
      .values({
        name: input.name,
        value: input.value,
        category: input.category ?? 'general',
      })
      .returning()

    return toItemData(rows[0])
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(items)
      .where(eq(items.id, id))
      .returning({ id: items.id })

    return rows.length > 0
  }

  async getSummary(): Promise<ItemSummary> {
    const [countResult] = await this.db
      .select({ count: count() })
      .from(items)

    const [sumResult] = await this.db
      .select({ sum: sum(items.value) })
      .from(items)

    const categoryRows = await this.db
      .selectDistinct({ category: items.category })
      .from(items)
      .orderBy(asc(items.category))

    return {
      total: countResult.count,
      totalValue: Number(sumResult.sum ?? 0),
      categories: categoryRows.map((r) => r.category),
    }
  }
}

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(key: string): Promise<string | undefined> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))

    return rows[0]?.value
  }

  async set(key: string, value: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(settings)
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }
}

function toItemData(row: typeof items.$inferSelect): ItemData {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    category: row.category,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
