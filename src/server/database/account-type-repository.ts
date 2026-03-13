// PRD-FEAT-003: Account Type Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { accountTypes } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  AccountType,
  UpdateAccountTypePayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class AccountTypeRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly AccountType[]> {
    const rows = await this.db
      .select()
      .from(accountTypes)
      .orderBy(asc(accountTypes.name))

    return rows.map(toAccountType)
  }

  async findById(id: number): Promise<AccountType | undefined> {
    const rows = await this.db
      .select()
      .from(accountTypes)
      .where(eq(accountTypes.id, id))

    return rows[0] ? toAccountType(rows[0]) : undefined
  }

  async create(input: CreateAccountTypePayload): Promise<AccountType> {
    const rows = await this.db
      .insert(accountTypes)
      .values({
        name: input.name,
        shortCode: input.short_code ?? null,
        taxTreatment: input.tax_treatment ?? '일반',
      })
      .returning()

    return toAccountType(rows[0])
  }

  async update(
    id: number,
    input: UpdateAccountTypePayload,
  ): Promise<AccountType | undefined> {
    const updates: Partial<typeof accountTypes.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.short_code !== undefined) updates.shortCode = input.short_code
    if (input.tax_treatment !== undefined) updates.taxTreatment = input.tax_treatment

    const rows = await this.db
      .update(accountTypes)
      .set(updates)
      .where(eq(accountTypes.id, id))
      .returning()

    return rows[0] ? toAccountType(rows[0]) : undefined
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(accountTypes)
      .where(eq(accountTypes.id, id))
      .returning({ id: accountTypes.id })

    return rows.length > 0
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(accountTypes)

    return result?.value ?? 0
  }

}

function toAccountType(
  row: typeof accountTypes.$inferSelect,
): AccountType {
  return {
    id: row.id,
    name: row.name,
    short_code: row.shortCode,
    tax_treatment: row.taxTreatment,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
