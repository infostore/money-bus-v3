---
paths:
  - 'src/server/database/schema.ts'
  - 'drizzle/**'
  - 'drizzle.config.ts'
---

# Migration Patterns (Drizzle ORM + PostgreSQL)

## Policy

- MUST define all tables in `src/server/database/schema.ts` using Drizzle schema builders
- MUST generate migrations with `npm run db:generate` (drizzle-kit generate)
- MUST apply migrations with `npm run db:migrate` (drizzle-kit migrate)
- MUST NOT manually edit generated SQL files in `drizzle/`
- MUST NOT modify existing migration files — schema changes are append-only
- Migrations run automatically on server start via `runMigrations()` in `setup.ts`

## Schema Definition

```ts
import { pgTable, serial, text, real, timestamp } from 'drizzle-orm/pg-core'

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  value: real('value').notNull().default(0),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

## Column Type Reference

| TypeScript | Drizzle Builder | PostgreSQL |
|-----------|----------------|------------|
| `number` (auto PK) | `serial('id').primaryKey()` | `SERIAL PRIMARY KEY` |
| `string` | `text('col').notNull()` | `TEXT NOT NULL` |
| `number` (float) | `real('col')` | `REAL` |
| `number` (int) | `integer('col')` | `INTEGER` |
| `boolean` | `boolean('col')` | `BOOLEAN` |
| `Date` | `timestamp('col', { withTimezone: true })` | `TIMESTAMPTZ` |

## Adding a New Table

1. Add table definition in `src/server/database/schema.ts`
2. Run `npm run db:generate` to create migration SQL
3. Run `npm run db:migrate` or restart server to apply

## Adding a Column

1. Add column to existing table in `schema.ts`
2. Run `npm run db:generate`
3. Review generated migration in `drizzle/`
4. Apply with `npm run db:migrate`

## Drizzle Config

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
})
```
