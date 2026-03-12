# Hono Backend Pattern Examples

## Route Handler (async)

```typescript
app.get('/api/items', async (c) => {
  const data = await repository.findAll()
  return c.json<ApiResponse<readonly ItemData[]>>({ success: true, data, error: null })
})
```

## Route with Input Validation

```typescript
app.post('/', async (c) => {
  const body = await c.req.json<CreateItemPayload>()

  if (!body.name || typeof body.value !== 'number') {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'name (string) and value (number) are required' },
      400,
    )
  }

  const data = await items.create(body)
  return c.json<ApiResponse<ItemData>>({ success: true, data, error: null }, 201)
})
```

## Route with Path Parameter

```typescript
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (isNaN(id)) {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'Invalid id' },
      400,
    )
  }

  const deleted = await items.delete(id)

  if (!deleted) {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'Item not found' },
      404,
    )
  }

  return c.json<ApiResponse<boolean>>({ success: true, data: true, error: null })
})
```

## Route Factory Pattern

```typescript
export function createItemRoutes(items: ItemRepository): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const data = await items.findAll()
    return c.json<ApiResponse<readonly ItemData[]>>({ success: true, data, error: null })
  })

  return app
}

// Usage in index.ts
app.route('/api/items', createItemRoutes(itemRepo))
```

## Repository Pattern (Drizzle ORM)

```typescript
export class ItemRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly ItemData[]> {
    const rows = await this.db
      .select()
      .from(items)
      .orderBy(desc(items.createdAt))
    return rows.map(toItemData)
  }
}
```

## Database Setup (PostgreSQL + Drizzle)

```typescript
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
})
export const db = drizzle(pool, { schema })
```

## Health Check

```typescript
app.get('/api/health', async (c) => {
  const dbHealthy = await checkConnection().catch(() => false)
  const status = dbHealthy ? 'healthy' : 'unhealthy'
  return c.json({ status, timestamp: new Date().toISOString() }, dbHealthy ? 200 : 503)
})
```

## Production Static Serving

```typescript
if (existsSync('./dist/client')) {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ root: './dist/client', path: 'index.html' }))
}
```
