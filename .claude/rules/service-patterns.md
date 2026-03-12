---
paths:
  - 'src/server/services/**/*.ts'
---

# Service Layer Patterns

## Policy

- MUST inject repositories via constructor (never import db directly)
- MUST declare all injected fields as `private readonly`
- MUST return typed results from `src/shared/types.ts` (never raw DB rows)
- MUST use `readonly` on array return types (`readonly T[]`)
- MUST use `async/await` — all database operations are async with PostgreSQL
- MUST NOT access Hono context (`c`) — services are HTTP-agnostic
- MUST NOT mutate input parameters — create new objects with spread
- MUST extract domain constants to file-level `const`

## Constructor (Dependency Injection)

```ts
import type { ItemRepository } from '../database/repositories.js'

export class ItemService {
  constructor(private readonly items: ItemRepository) {}

  async getActiveItems(): Promise<readonly ItemData[]> {
    const all = await this.items.findAll()
    return all.filter((item) => item.value > 0)
  }
}
```

## Multi-Dependency Services

```ts
interface MyServiceDeps {
  readonly itemRepo: ItemRepository
  readonly settingsRepo: SettingsRepository
}

export class MyService {
  private readonly itemRepo: ItemRepository
  private readonly settingsRepo: SettingsRepository

  constructor({ itemRepo, settingsRepo }: MyServiceDeps) {
    this.itemRepo = itemRepo
    this.settingsRepo = settingsRepo
  }
}
```

## Pure Function Services

Stateless calculators MAY use exported functions instead of classes:

```ts
const DEFAULT_RATE = 0.1

export function calculateTotal(items: readonly number[]): number {
  return items.reduce((sum, item) => sum + item, 0)
}
```

## Cross-Service Composition

- MUST inject collaborating repositories, not other services
- MUST use `db.transaction()` for multi-write operations spanning repositories

```ts
async syncBatch(ids: readonly number[]): Promise<number> {
  let synced = 0
  await this.db.transaction(async (tx) => {
    for (const id of ids) {
      const result = await this.processItem(tx, id)
      if (result) synced++
    }
  })
  return synced
}
```

## Error Handling

- Return `undefined` or `false` for not-found cases (not exceptions)
- Throw only for truly exceptional conditions (corrupt data, invariant violations)
- Guard early: validate and return before main logic

## Wiring in Routes

```ts
export function createItemRoutes(repo: ItemRepository): Hono {
  const service = new ItemService(repo)
  const app = new Hono()

  app.get('/:id', async (c) => {
    const data = await service.getItemOrThrow(Number(c.req.param('id')))
    return c.json<ApiResponse<ItemData>>({ success: true, data, error: null })
  })

  return app
}
```
