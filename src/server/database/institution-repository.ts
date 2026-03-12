// PRD-FEAT-002: Institution Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { institutions } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

const DEFAULT_INSTITUTIONS: readonly CreateInstitutionPayload[] = [
  // 증권 (10)
  { name: '삼성증권', category: '증권' },
  { name: 'KB증권', category: '증권' },
  { name: '미래에셋증권', category: '증권' },
  { name: 'NH투자증권', category: '증권' },
  { name: '한국투자증권', category: '증권' },
  { name: '신한투자증권', category: '증권' },
  { name: '키움증권', category: '증권' },
  { name: '대신증권', category: '증권' },
  { name: '토스증권', category: '증권' },
  { name: '카카오페이증권', category: '증권' },
  // 은행 (5)
  { name: '국민은행', category: '은행' },
  { name: '신한은행', category: '은행' },
  { name: '하나은행', category: '은행' },
  { name: '우리은행', category: '은행' },
  { name: '농협은행', category: '은행' },
  // 운용사 (10)
  { name: '삼성자산운용', category: '운용사' },
  { name: '미래에셋자산운용', category: '운용사' },
  { name: 'KB자산운용', category: '운용사' },
  { name: '한국투자신탁운용', category: '운용사' },
  { name: '신한자산운용', category: '운용사' },
  { name: '한화자산운용', category: '운용사' },
  { name: 'NH-Amundi자산운용', category: '운용사' },
  { name: '키움투자자산운용', category: '운용사' },
  { name: '타임폴리오자산운용', category: '운용사' },
  { name: 'KoAct자산운용', category: '운용사' },
] as const

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

  async seed(): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const inst of DEFAULT_INSTITUTIONS) {
        await tx.insert(institutions).values({
          name: inst.name,
          category: inst.category ?? '증권',
        })
      }
    })
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
