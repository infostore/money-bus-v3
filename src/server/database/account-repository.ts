// PRD-FEAT-010: Account Management
import { eq, asc, count } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { accounts, familyMembers, institutions, accountTypes } from './schema.js'
import type * as schemaTypes from './schema.js'
import type {
  AccountWithDetails,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class AccountRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly AccountWithDetails[]> {
    const rows = await this.db
      .select({
        id: accounts.id,
        accountName: accounts.accountName,
        accountNumber: accounts.accountNumber,
        familyMemberId: accounts.familyMemberId,
        familyMemberName: familyMembers.name,
        institutionId: accounts.institutionId,
        institutionName: institutions.name,
        accountTypeId: accounts.accountTypeId,
        accountTypeName: accountTypes.name,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .innerJoin(familyMembers, eq(accounts.familyMemberId, familyMembers.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
      .orderBy(asc(accounts.accountName))

    return rows.map(toAccountWithDetails)
  }

  async findById(id: number): Promise<AccountWithDetails | undefined> {
    const rows = await this.db
      .select({
        id: accounts.id,
        accountName: accounts.accountName,
        accountNumber: accounts.accountNumber,
        familyMemberId: accounts.familyMemberId,
        familyMemberName: familyMembers.name,
        institutionId: accounts.institutionId,
        institutionName: institutions.name,
        accountTypeId: accounts.accountTypeId,
        accountTypeName: accountTypes.name,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .innerJoin(familyMembers, eq(accounts.familyMemberId, familyMembers.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
      .where(eq(accounts.id, id))

    return rows[0] ? toAccountWithDetails(rows[0]) : undefined
  }

  async create(input: CreateAccountPayload): Promise<AccountWithDetails> {
    const rows = await this.db
      .insert(accounts)
      .values({
        accountName: input.account_name,
        accountNumber: input.account_number ?? null,
        familyMemberId: input.family_member_id,
        institutionId: input.institution_id,
        accountTypeId: input.account_type_id,
      })
      .returning()

    return (await this.findById(rows[0].id))!
  }

  async update(
    id: number,
    input: UpdateAccountPayload,
  ): Promise<AccountWithDetails | undefined> {
    const updates: Partial<typeof accounts.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (input.account_name !== undefined) updates.accountName = input.account_name
    if (input.account_number !== undefined) updates.accountNumber = input.account_number
    if (input.family_member_id !== undefined) updates.familyMemberId = input.family_member_id
    if (input.institution_id !== undefined) updates.institutionId = input.institution_id
    if (input.account_type_id !== undefined) updates.accountTypeId = input.account_type_id

    const rows = await this.db
      .update(accounts)
      .set(updates)
      .where(eq(accounts.id, id))
      .returning()

    if (rows.length === 0) return undefined

    return (await this.findById(rows[0].id))!
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(accounts)
      .where(eq(accounts.id, id))
      .returning({ id: accounts.id })

    return rows.length > 0
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(accounts)

    return result?.value ?? 0
  }
}

interface JoinedAccountRow {
  readonly id: number
  readonly accountName: string
  readonly accountNumber: string | null
  readonly familyMemberId: number
  readonly familyMemberName: string
  readonly institutionId: number
  readonly institutionName: string
  readonly accountTypeId: number
  readonly accountTypeName: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

function toAccountWithDetails(row: JoinedAccountRow): AccountWithDetails {
  return {
    id: row.id,
    account_name: row.accountName,
    account_number: row.accountNumber,
    family_member_id: row.familyMemberId,
    family_member_name: row.familyMemberName,
    institution_id: row.institutionId,
    institution_name: row.institutionName,
    account_type_id: row.accountTypeId,
    account_type_name: row.accountTypeName,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
