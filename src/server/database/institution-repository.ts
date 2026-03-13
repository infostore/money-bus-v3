// PRD-FEAT-002: Institution Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { institutions } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  Institution,
  UpdateInstitutionPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class InstitutionRepository {
  constructor(private readonly db: Database) {}

  async findAll(category?: string): Promise<readonly Institution[]> {
    const query = this.db.select().from(institutions)

    if (category) {
      const rows = await query
        .where(eq(institutions.category, category))
        .orderBy(asc(institutions.name))
      return rows.map(toInstitution)
    }

    const rows = await query.orderBy(asc(institutions.name))
    return rows.map(toInstitution)
  }

  async findById(id: number): Promise<Institution | undefined> {
    const rows = await this.db
      .select()
      .from(institutions)
      .where(eq(institutions.id, id))

    return rows[0] ? toInstitution(rows[0]) : undefined
  }

  async create(input: CreateInstitutionPayload): Promise<Institution> {
    const rows = await this.db
      .insert(institutions)
      .values({
        name: input.name,
        category: input.category ?? '증권',
      })
      .returning()

    return toInstitution(rows[0])
  }

  async update(
    id: number,
    input: UpdateInstitutionPayload,
  ): Promise<Institution | undefined> {
    const updates: Partial<typeof institutions.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.category !== undefined) updates.category = input.category

    const rows = await this.db
      .update(institutions)
      .set(updates)
      .where(eq(institutions.id, id))
      .returning()

    return rows[0] ? toInstitution(rows[0]) : undefined
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(institutions)
      .where(eq(institutions.id, id))
      .returning({ id: institutions.id })

    return rows.length > 0
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(institutions)

    return result?.value ?? 0
  }

}

function toInstitution(
  row: typeof institutions.$inferSelect,
): Institution {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
