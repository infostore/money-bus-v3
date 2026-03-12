// PRD-FEAT-003: Account Type Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { accountTypes } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  AccountType,
  CreateAccountTypePayload,
  UpdateAccountTypePayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

const DEFAULT_ACCOUNT_TYPES: readonly CreateAccountTypePayload[] = [
  // 세금우대 (Tax-Advantaged)
  { name: 'ISA (개인종합자산관리계좌)', short_code: 'ISA', tax_treatment: '세금우대' },
  { name: '비과세종합저축', tax_treatment: '세금우대' },
  { name: '청년도약계좌', short_code: '청년도약', tax_treatment: '세금우대' },
  { name: '청년희망적금', short_code: '청년희망', tax_treatment: '세금우대' },
  // 일반 (General)
  { name: '일반위탁계좌', short_code: '일반위탁', tax_treatment: '일반' },
  { name: 'CMA', short_code: 'CMA', tax_treatment: '일반' },
  { name: '해외주식 위탁계좌', short_code: '해외주식', tax_treatment: '일반' },
  { name: '예금', tax_treatment: '일반' },
  { name: '적금', tax_treatment: '일반' },
  // 연금 (Pension)
  { name: '연금저축계좌', short_code: '개인연금', tax_treatment: '연금' },
  { name: 'IRP (개인형퇴직연금)', short_code: 'IRP', tax_treatment: '연금' },
  { name: '퇴직연금 DC', short_code: 'DC', tax_treatment: '연금' },
  { name: '퇴직연금 DB', short_code: 'DB', tax_treatment: '연금' },
] as const

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

  async seed(): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(accountTypes)
        .values(
          DEFAULT_ACCOUNT_TYPES.map((at) => ({
            name: at.name,
            shortCode: at.short_code ?? null,
            taxTreatment: at.tax_treatment ?? '일반',
          })),
        )
        .onConflictDoNothing()
    })
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
