import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import * as schema from './schema.js'

const DATABASE_URL = process.env['DATABASE_URL']

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
})

export const db = drizzle(pool, { schema })

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' })
}

export async function checkConnection(): Promise<boolean> {
  const client = await pool.connect()
  client.release()
  return true
}

export async function closeDatabase(): Promise<void> {
  await pool.end()
}
