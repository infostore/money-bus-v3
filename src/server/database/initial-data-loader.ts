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
  readonly institutions: SyncTableResult
  readonly accountTypes: SyncTableResult
  readonly products: SyncTableResult
}

interface SyncableRow {
  readonly name: string
  readonly updated_at: string
  readonly [key: string]: unknown
}

interface TableConfig {
  readonly tableName: string
  readonly columns: readonly string[]
  readonly pgSelectSql: string
  readonly pgInsertSql: string
  readonly pgUpdateSql: string
}

const INSTITUTIONS_CONFIG: TableConfig = {
  tableName: 'institutions',
  columns: ['name', 'category', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, category, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM institutions`,
  pgInsertSql: `INSERT INTO institutions (name, category, created_at, updated_at) VALUES ($1, $2, $3::timestamptz, $4::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE institutions SET category = $2, updated_at = $3::timestamptz WHERE name = $1`,
}

const ACCOUNT_TYPES_CONFIG: TableConfig = {
  tableName: 'account_types',
  columns: ['name', 'short_code', 'tax_treatment', 'created_at', 'updated_at'],
  pgSelectSql: `SELECT name, short_code, tax_treatment, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at FROM account_types`,
  pgInsertSql: `INSERT INTO account_types (name, short_code, tax_treatment, created_at, updated_at) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz) ON CONFLICT (name) DO NOTHING`,
  pgUpdateSql: `UPDATE account_types SET short_code = $2, tax_treatment = $3, updated_at = $4::timestamptz WHERE name = $1`,
}

const PRODUCTS_CONFIG: TableConfig = {
  tableName: 'products',
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
  const dataCols = config.columns.filter((c) => c !== 'name' && c !== 'created_at')
  const setClauses = dataCols.map((c) => `${c} = ?`).join(', ')
  return `UPDATE ${config.tableName} SET ${setClauses} WHERE name = ?`
}

function rowToSqliteInsertParams(row: SyncableRow, config: TableConfig): unknown[] {
  return config.columns.map((c) => row[c] ?? null)
}

function rowToSqliteUpdateParams(row: SyncableRow, config: TableConfig): unknown[] {
  const dataCols = config.columns.filter((c) => c !== 'name' && c !== 'created_at')
  return [...dataCols.map((c) => row[c] ?? null), row['name']]
}

function rowToPgInsertParams(row: SyncableRow, config: TableConfig): unknown[] {
  return config.columns.map((c) => row[c] ?? null)
}

function rowToPgUpdateParams(row: SyncableRow, config: TableConfig): unknown[] {
  const dataCols = config.columns.filter((c) => c !== 'name' && c !== 'created_at')
  return [row['name'], ...dataCols.map((c) => row[c] ?? null)]
}

async function syncTable(
  pgDb: PgDb,
  sqliteDb: InstanceType<typeof Database>,
  config: TableConfig,
): Promise<SyncTableResult> {
  const result = { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 }

  // Load both sides keyed by name
  const pgResult = await pgDb.execute(sql.raw(config.pgSelectSql))
  const pgRows = (pgResult as unknown as { rows: SyncableRow[] }).rows
  const pgMap = new Map<string, SyncableRow>()
  for (const row of pgRows) {
    pgMap.set(row['name'] as string, row)
  }

  const sqliteRows = sqliteDb.prepare(`SELECT * FROM ${config.tableName}`).all() as SyncableRow[]
  const sqliteMap = new Map<string, SyncableRow>()
  for (const row of sqliteRows) {
    sqliteMap.set(row['name'] as string, row)
  }

  // SQLite → PG: new records and updates
  for (const [name, slRow] of sqliteMap) {
    const pgRow = pgMap.get(name)
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
    for (const [name, pgRow] of pgMap) {
      const slRow = sqliteMap.get(name)
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

export async function syncInitialData(
  pgDb: PgDb,
  sqlitePath: string,
): Promise<SyncResult> {
  if (!existsSync(sqlitePath)) {
    log('warn', `Initial data file not found: ${sqlitePath}`)
    return {
      institutions: { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 },
      accountTypes: { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 },
      products: { pgInserted: 0, pgUpdated: 0, sqliteInserted: 0, sqliteUpdated: 0 },
    }
  }

  const sqliteDb = new Database(sqlitePath)
  sqliteDb.pragma('journal_mode = WAL')

  try {
    const institutions = await syncTable(pgDb, sqliteDb, INSTITUTIONS_CONFIG)
    const accountTypes = await syncTable(pgDb, sqliteDb, ACCOUNT_TYPES_CONFIG)
    const products = await syncTable(pgDb, sqliteDb, PRODUCTS_CONFIG)

    return { institutions, accountTypes, products }
  } finally {
    sqliteDb.close()
  }
}
