// PRD-FEAT-001: Family Member Management
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { familyMembers } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class FamilyMemberRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly FamilyMember[]> {
    const rows = await this.db
      .select()
      .from(familyMembers)
      .orderBy(asc(familyMembers.id))

    return rows.map(toFamilyMember)
  }

  async findById(id: number): Promise<FamilyMember | undefined> {
    const rows = await this.db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, id))

    return rows[0] ? toFamilyMember(rows[0]) : undefined
  }

  async create(input: CreateFamilyMemberPayload): Promise<FamilyMember> {
    const rows = await this.db
      .insert(familyMembers)
      .values({
        name: input.name,
        relationship: input.relationship ?? '본인',
        birthYear: input.birth_year ?? null,
      })
      .returning()

    return toFamilyMember(rows[0])
  }

  async update(
    id: number,
    input: UpdateFamilyMemberPayload,
  ): Promise<FamilyMember | undefined> {
    const updates: Partial<typeof familyMembers.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.relationship !== undefined)
      updates.relationship = input.relationship
    if (input.birth_year !== undefined)
      updates.birthYear = input.birth_year

    const rows = await this.db
      .update(familyMembers)
      .set(updates)
      .where(eq(familyMembers.id, id))
      .returning()

    return rows[0] ? toFamilyMember(rows[0]) : undefined
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(familyMembers)
      .where(eq(familyMembers.id, id))
      .returning({ id: familyMembers.id })

    return rows.length > 0
  }
}

function toFamilyMember(
  row: typeof familyMembers.$inferSelect,
): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    birth_year: row.birthYear,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
