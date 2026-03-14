// PRD-FEAT-006: Bidirectional sync between SQLite initial.db and PostgreSQL
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schemaTypes from './schema.js'
import { log } from '../middleware/logger.js'

type PgDb = NodePgDatabase<typeof schemaTypes>

interface SyncTableResult {
  readonly pgInserted: number
  readonly pgUpdated: number
  readonly sqliteInserted: number
  readonly sqliteUpdated: number
}

export interface SyncResult {
  readonly familyMembers: SyncTableResult
  readonly institutions: SyncTableResult
  readonly accountTypes: SyncTableResult
  readonly accounts: SyncTableResult
  readonly products: SyncTableResult
  readonly etfProfiles: SyncTableResult
}

interface SyncableRow {
  readonly updated_at: string
  readonly [key: string]: unknown
}

interface TableConfig {
  readonly tableName: string
  readonly keyColumn: string
  readonly columns: readonly string[]
  readonly pgSelectSql: string
  readonly pgInsertSql: string
  readonly pgUpdateSql: string
}

const FAMILY_MEMBERS_CONFIG: TableConfig = {
  tableName: 'family_members',
  keyColumn: 'name',
  columns: ['name', 'relationship', 'birth_year', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, relationship, birth_year, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM family_members`,
  pgInsertSql: `INSERT INTO family_members (name, relationship, birth_year, created_at, updated_at) VALUES ($1, $2, $3::int, $4::timestamptz, $5::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE family_members SET relationship = $2, birth_year = $3::int, updated_at = $4::timestamptz WHERE name = $1`,
}

const INSTITUTIONS_CONFIG: TableConfig = {
  tableName: 'institutions',
  keyColumn: 'name',
  columns: ['name', 'category', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, category, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM institutions`,
  pgInsertSql: `INSERT INTO institutions (name, category, created_at, updated_at) VALUES ($1, $2, $3::timestamptz, $4::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE institutions SET category = $2, updated_at = $3::timestamptz WHERE name = $1`,
}

const ACCOUNT_TYPES_CONFIG: TableConfig = {
  tableName: 'account_types',
  keyColumn: 'name',
  columns: ['name', 'short_code', 'tax_treatment', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, short_code, tax_treatment, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM account_types`,
  pgInsertSql: `INSERT INTO account_types (name, short_code, tax_treatment, created_at, updated_at) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE account_types SET short_code = $2, tax_treatment = $3, updated_at = $4::timestamptz WHERE name = $1`,
}

const ACCOUNTS_CONFIG: TableConfig = {
  tableName: 'accounts',
  keyColumn: 'account_name',
  columns: ['account_name', 'account_number', 'family_member_id', 'institution_id', 'account_type_id', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT account_name, account_number, family_member_id, institution_id, account_type_id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM accounts`,
  pgInsertSql: `INSERT INTO accounts (account_name, account_number, family_member_id, institution_id, account_type_id, created_at, updated_at) VALUES ($1, $2, $3::int, $4::int, $5::int, $6::timestamptz, $7::timestamptz) ON CONFLICT (account_name) DO NOTHING`,
  pgUpdateSql: `UPDATE accounts SET account_number = $2, family_member_id = $3::int, institution_id = $4::int, account_type_id = $5::int, updated_at = $6::timestamptz WHERE account_name = $1`,
}

const PRODUCTS_CONFIG: TableConfig = {
  tableName: 'products',
  keyColumn: 'name',
  columns: ['name', 'code', 'asset_type', 'currency', 'exchange', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, code, asset_type, currency, exchange, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM products`,
  pgInsertSql: `INSERT INTO products (name, code, asset_type, currency, exchange, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE products SET code = $2, asset_type = $3, currency = $4, exchange = $5, updated_at = $6::timestamptz WHERE name = $1`,
}

function buildSqliteInsert(config: TableConfig): string {
  const cols = config.columns.join(', ')
  const placeholders = config.columns.map(() => '?').join(', ')
  return `INSERT INTO ${config.tableName} (${cols}) VALUES (${placeholders})`
}

function buildSqliteUpdate(config: TableConfig): string {
  const { keyColumn } = config
  const dataCols = config.columns.filter((c) => c !== keyColumn && c !== 'created_at')
  const setClauses = dataCols.map((c) => `${c} = ?`).join(', ')
  return `UPDATE ${config.tableName} SET ${setClauses} WHERE ${keyColumn} = ?`
}

function rowToSqliteInsertParams(row: SyncableRow, config: TableConfig): unknown[] {
  return config.columns.map((c) => row[c] ?? null)
}

function rowToSqliteUpdateParams(row: SyncableRow, config: TableConfig): unknown[] {
  const { keyColumn } = config
  const dataCols = config.columns.filter((c) => c !== keyColumn && c !== 'created_at')
  return [...dataCols.map((c) => row[c] ?? null), row[keyColumn]]
}

function rowToPgInsertParams(row: SyncableRow, config: TableConfig): unknown[] {
  return config.columns.map((c) => row[c] ?? null)
}

function rowToPgUpdateParams(row: SyncableRow, config: TableConfig): unknown[] {
  const { keyColumn } = config
  const dataCols = config.columns.filter((c) => c !== keyColumn && c !== 'created_at')
  return [row[keyColumn], ...dataCols.map((c) => row[c] ?? null)]
}

async function syncTable(
  pgDb: PgDb,
  sqliteDb: InstanceType<typeof Database>,
  config: TableConfig,
): Promise<SyncTableResult> {
  const result = { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 }
  const { keyColumn } = config

  // Load both sides keyed by keyColumn
  const pgResult = await pgDb.execute(sql.raw(config.pgSelectSql))
  const pgRows = (pgResult as unknown as { rows: SyncableRow[] }).rows
  const pgMap = new Map<string, SyncableRow>()
  for (const row of pgRows) {
    pgMap.set(row[keyColumn] as string, row)
  }

  const sqliteRows = sqliteDb.prepare(`SELECT * FROM ${config.tableName}`).all() as SyncableRow[]
  const sqliteMap = new Map<string, SyncableRow>()
  for (const row of sqliteRows) {
    sqliteMap.set(row[keyColumn] as string, row)
  }

  // SQLite → PG: new records and updates
  for (const [, slRow] of sqliteMap) {
    const key = slRow[keyColumn] as string
    const pgRow = pgMap.get(key)
    if (!pgRow) {
      await pgDb.execute(sql.raw(buildParamQuery(config.pgInsertSql, rowToPgInsertParams(slRow, config))))
      result.pgInserted++
    } else if (slRow['updated_at'] > pgRow['updated_at']) {
      await pgDb.execute(sql.raw(buildParamQuery(config.pgUpdateSql, rowToPgUpdateParams(slRow, config))))
      result.pgUpdated++
    }
  }

  // PG → SQLite: new records and updates
  const slInsert = sqliteDb.prepare(buildSqliteInsert(config))
  const slUpdate = sqliteDb.prepare(buildSqliteUpdate(config))

  const writeTx = sqliteDb.transaction(() => {
    for (const [, pgRow] of pgMap) {
      const key = pgRow[keyColumn] as string
      const slRow = sqliteMap.get(key)
      if (!slRow) {
        slInsert.run(...rowToSqliteInsertParams(pgRow, config))
        result.sqliteInserted++
      } else if (pgRow['updated_at'] > slRow['updated_at']) {
        slUpdate.run(...rowToSqliteUpdateParams(pgRow, config))
        result.sqliteUpdated++
      }
    }
  })
  writeTx()

  return result
}

function buildParamQuery(template: string, params: unknown[]): string {
  let query = template
  for (let i = params.length; i >= 1; i--) {
    const val = params[i - 1]
    const escaped = val === null || val === undefined
      ? 'NULL'
      : `'${String(val).replace(/'/g, "''")}'`
    query = query.replace(new RegExp(`\\$${i}(?:::\\w+)?`, 'g'), escaped)
  }
  return query
}

interface EtfProfileRow {
  readonly product_code: string
  readonly manager: string
  readonly expense_ratio: string | null
  readonly download_url: string
  readonly download_type: string
  readonly created_at: string
  readonly updated_at: string
}

async function syncEtfProfiles(
  pgDb: PgDb,
  sqliteDb: InstanceType<typeof Database>,
): Promise<SyncTableResult> {
  const result = { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 }

  const tableExists = sqliteDb.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='etf_profiles'`,
  ).get()
  if (!tableExists) return result

  const sqliteRows = sqliteDb.prepare('SELECT * FROM etf_profiles').all() as EtfProfileRow[]
  if (sqliteRows.length === 0) return result

  // Build product code → id mapping from PG
  const pgProducts = await pgDb.execute(sql.raw(`SELECT id, code FROM products WHERE code IS NOT NULL`))
  const codeToId = new Map<string, number>()
  for (const row of (pgProducts as unknown as { rows: Array<{ id: number; code: string }> }).rows) {
    codeToId.set(row.code, row.id)
  }

  // Load existing PG etf_profiles keyed by product_id
  const pgResult = await pgDb.execute(sql.raw(
    `SELECT ep.product_id, p.code as product_code, ep.manager, ep.expense_ratio, ep.download_url, ep.download_type,
      to_char(ep.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
      to_char(ep.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
     FROM etf_profiles ep JOIN products p ON ep.product_id = p.id`,
  ))
  const pgMap = new Map<string, SyncableRow>()
  for (const row of (pgResult as unknown as { rows: SyncableRow[] }).rows) {
    pgMap.set(row['product_code'] as string, row)
  }

  // SQLite → PG
  for (const slRow of sqliteRows) {
    const productId = codeToId.get(slRow.product_code)
    if (productId === undefined) continue

    const pgRow = pgMap.get(slRow.product_code)
    if (!pgRow) {
      await pgDb.execute(sql.raw(buildParamQuery(
        `INSERT INTO etf_profiles (product_id, manager, expense_ratio, download_url, download_type, created_at, updated_at)
         VALUES ($1::int, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
         ON CONFLICT (product_id) DO NOTHING`,
        [productId, slRow.manager, slRow.expense_ratio, slRow.download_url, slRow.download_type, slRow.created_at, slRow.updated_at],
      )))
      result.pgInserted++
    } else if (slRow.updated_at > (pgRow['updated_at'] as string)) {
      await pgDb.execute(sql.raw(buildParamQuery(
        `UPDATE etf_profiles SET manager = $1, expense_ratio = $2, download_url = $3, download_type = $4, updated_at = $5::timestamptz
         WHERE product_id = $6::int`,
        [slRow.manager, slRow.expense_ratio, slRow.download_url, slRow.download_type, slRow.updated_at, productId],
      )))
      result.pgUpdated++
    }
  }

  // PG → SQLite: sync back any profiles added via PG
  const slInsert = sqliteDb.prepare(
    `INSERT OR IGNORE INTO etf_profiles (product_code, manager, expense_ratio, download_url, download_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const slUpdate = sqliteDb.prepare(
    `UPDATE etf_profiles SET manager = ?, expense_ratio = ?, download_url = ?, download_type = ?, updated_at = ?
     WHERE product_code = ?`,
  )
  const sqliteMap = new Map(sqliteRows.map((r) => [r.product_code, r]))

  const writeTx = sqliteDb.transaction(() => {
    for (const [, pgRow] of pgMap) {
      const code = pgRow['product_code'] as string
      const slRow = sqliteMap.get(code)
      if (!slRow) {
        slInsert.run(code, pgRow['manager'], pgRow['expense_ratio'] ?? null, pgRow['download_url'], pgRow['download_type'], pgRow['created_at'], pgRow['updated_at'])
        result.sqliteInserted++
      } else if ((pgRow['updated_at'] as string) > slRow.updated_at) {
        slUpdate.run(pgRow['manager'], pgRow['expense_ratio'] ?? null, pgRow['download_url'], pgRow['download_type'], pgRow['updated_at'], code)
        result.sqliteUpdated++
      }
    }
  })
  writeTx()

  return result
}

export async function syncInitialData(
  pgDb: PgDb,
  sqlitePath: string,
): Promise<SyncResult> {
  const empty: SyncTableResult = { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 }
  if (!existsSync(sqlitePath)) {
    log('warn', `Initial data file not found: ${sqlitePath}`)
    return { familyMembers: empty, institutions: empty, accountTypes: empty, accounts: empty, products: empty, etfProfiles: empty }
  }

  const sqliteDb = new Database(sqlitePath)
  sqliteDb.pragma('journal_mode = WAL')

  try {
    // Sync order matters: reference tables first, then dependent tables
    const familyMembers = await syncTable(pgDb, sqliteDb, FAMILY_MEMBERS_CONFIG)
    const institutions = await syncTable(pgDb, sqliteDb, INSTITUTIONS_CONFIG)
    const accountTypes = await syncTable(pgDb, sqliteDb, ACCOUNT_TYPES_CONFIG)
    const accounts = await syncTable(pgDb, sqliteDb, ACCOUNTS_CONFIG)
    const products = await syncTable(pgDb, sqliteDb, PRODUCTS_CONFIG)
    const etfProfiles = await syncEtfProfiles(pgDb, sqliteDb)

    return { familyMembers, institutions, accountTypes, accounts, products, etfProfiles }
  } finally {
    sqliteDb.close()
  }
}
