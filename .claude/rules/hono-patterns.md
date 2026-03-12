# Hono Backend Patterns

## Route Handler Pattern
```typescript
import { Hono } from 'hono'
const app = new Hono()

app.get('/api/items', async (c) => {
  const data = await repository.findAll()
  return c.json<ApiResponse<readonly ItemData[]>>({ success: true, data, error: null })
})
```

## Middleware Pattern
```typescript
import type { MiddlewareHandler } from 'hono'

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  log('info', `${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`)
}
```

## Database Patterns

### Repository Pattern (Drizzle ORM)
```typescript
import { eq, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export class ItemRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly ItemData[]> {
    const rows = await this.db.select().from(items).orderBy(desc(items.createdAt))
    return rows.map(toItemData)
  }
}
```

### Migration Pattern (Drizzle Kit)
```typescript
// Schema defined in src/server/database/schema.ts
// Migrations generated: npm run db:generate
// Migrations applied: npm run db:migrate (or auto on server start)
```

### PostgreSQL Connection Pool
```typescript
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
})
export const db = drizzle(pool, { schema })
```

## API Response Pattern
```typescript
interface ApiResponse<T> {
  readonly success: boolean
  readonly data: T | null
  readonly error: string | null
}
```

## Production Static Serving
```typescript
import { serveStatic } from '@hono/node-server/serve-static'
if (existsSync('./dist/client')) {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ root: './dist/client', path: 'index.html' }))
}
```

## Security Patterns
- Validate ALL request body inputs before processing
- Use Drizzle query builder (parameterized by default)
- Set appropriate CORS headers for production
- Never expose stack traces in API error responses
