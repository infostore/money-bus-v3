---
name: guide-database
description: SQLite WAL database patterns, repository implementation, migrations, and transaction usage
user-invocable: false
---

# Database Patterns

## Database Setup

`src/server/database/setup.ts` — Three required pragmas:

```typescript
db.pragma('journal_mode = WAL')   // concurrent reads
db.pragma('foreign_keys = ON')    // referential integrity
db.pragma('busy_timeout = 5000')  // lock contention timeout
```

## Repository Pattern

No base class. Each repository is independent, accepts `Database` via constructor.

```typescript
export class ThingRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Thing[] {
    return this.db.prepare('SELECT * FROM things ORDER BY name').all() as Thing[]
  }

  findById(id: number): Thing | undefined {
    return this.db.prepare('SELECT * FROM things WHERE id = ?').get(id) as Thing | undefined
  }

  create(input: CreateThingPayload): Thing {
    const result = this.db.prepare(
      'INSERT INTO things (name, value) VALUES (?, ?)',
    ).run(input.name, input.value)
    return this.findById(Number(result.lastInsertRowid))!
  }

  update(id: number, input: UpdateThingPayload): Thing | undefined {
    this.db.prepare(
      'UPDATE things SET name = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(input.name, id)
    return this.findById(id)
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM things WHERE id = ?').run(id).changes > 0
  }
}
```

## Dynamic WHERE Clauses

```typescript
const conditions: string[] = []
const params: unknown[] = []

if (filter.account_id) {
  conditions.push('t.account_id = ?')
  params.push(filter.account_id)
}

const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
const rows = this.db.prepare(`SELECT * FROM things ${where}`).all(...params) as Thing[]
```

## IN Clause

```typescript
findByIds(ids: readonly number[]): Thing[] {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  return this.db.prepare(
    `SELECT * FROM things WHERE id IN (${placeholders})`,
  ).all(...ids) as Thing[]
}
```

## Transactions

Used for atomic multi-step operations:

```typescript
create(input: CreateTradePayload): Trade {
  const doCreate = this.db.transaction(() => {
    const result = this.db.prepare('INSERT INTO trades (...) VALUES (?, ...)').run(...)
    this.updateRelated(...)
    return this.findById(Number(result.lastInsertRowid))!
  })
  return doCreate()
}
```

Multi-repository atomic operations:

```typescript
// When operation spans multiple repositories, wrap in shared transaction
transfer(fromId: number, toId: number, itemId: number) {
  const doTransfer = this.db.transaction(() => {
    this.itemRepo.updateOwner(itemId, toId)
    this.logRepo.recordTransfer(fromId, toId, itemId)
    const item = this.itemRepo.findById(itemId)
    if (!item) throw new Error('Item disappeared during transfer')
    return item
  })
  return doTransfer()
}
```

## Migration System

`src/server/database/migrations.ts` — Version-tracked, transactional:

```typescript
interface Migration {
  readonly version: number
  readonly description: string
  readonly up: string  // SQL DDL
}
```

Tracked in `_migrations` table. All pending migrations applied atomically. Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` for evolution.

## DI in Server

Repositories instantiated in `src/server/index.ts` and injected into route factories:

```typescript
const db = initDatabase()
const things = new ThingRepository(db)
app.route('/api/things', createThingRoutes(things))
```
