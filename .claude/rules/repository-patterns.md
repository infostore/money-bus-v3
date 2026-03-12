---
paths:
  - 'src/server/database/**/*.ts'
---

# Repository Patterns

## Policy

- MUST inject `NodePgDatabase<typeof schema>` via constructor as `private readonly db`
- MUST type all return values explicitly with `Promise<T>`
- MUST use `readonly T[]` for array return types in public method signatures
- MUST use Drizzle query builder — never raw SQL string interpolation
- MUST return `T | undefined` for single-row lookups (not `T | null`)
- MUST NOT expose raw Drizzle rows — map to typed domain objects via helper functions
- MUST NOT mutate query results — use spread (`{ ...row, extra }`) to add computed fields

## Database Type

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

type Database = NodePgDatabase<typeof schema>

export class MyRepository {
  constructor(private readonly db: Database) {}
}
```

## Method Naming

| Method | Signature | Purpose |
|--------|-----------|---------|
| `findAll` | `(filters?: Filters): Promise<readonly T[]>` | List with optional filters |
| `findById` | `(id: number): Promise<T \| undefined>` | Single row by PK |
| `create` | `(input: CreatePayload): Promise<T>` | Insert and return created row |
| `update` | `(id: number, input: UpdatePayload): Promise<T \| undefined>` | Update, return `undefined` if not found |
| `delete` | `(id: number): Promise<boolean>` | Delete, return `rows.length > 0` |

## Query Patterns

```ts
import { eq, desc, count, sum, asc } from 'drizzle-orm'
import { items } from './schema.js'

// Select all with ordering
const rows = await this.db
  .select()
  .from(items)
  .orderBy(desc(items.createdAt))

// Select by ID
const rows = await this.db
  .select()
  .from(items)
  .where(eq(items.id, id))

// Insert with returning
const rows = await this.db
  .insert(items)
  .values({ name, value, category })
  .returning()

// Delete with returning
const rows = await this.db
  .delete(items)
  .where(eq(items.id, id))
  .returning({ id: items.id })

// Upsert (onConflictDoUpdate)
await this.db
  .insert(settings)
  .values({ key, value })
  .onConflictDoUpdate({ target: settings.key, set: { value } })

// Aggregations
const [result] = await this.db
  .select({ count: count() })
  .from(items)
```

## Row Mapping

```ts
function toItemData(row: typeof items.$inferSelect): ItemData {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    category: row.category,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
```

## Transaction Pattern

```ts
await this.db.transaction(async (tx) => {
  await tx.insert(items).values(data1)
  await tx.insert(items).values(data2)
})
```
