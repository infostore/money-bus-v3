# Backend Development Patterns (Hono + PostgreSQL + Drizzle)

## API Design Patterns

### Route Factory Structure

```typescript
import { Hono } from 'hono'
import type { MyRepository } from '../database/repositories.js'
import type { ApiResponse, MyData } from '../../shared/types.js'

export function createMyRoutes(repo: MyRepository): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly MyData[]>>({ success: true, data, error: null })
  })

  return app
}
```

### Standardized Response Format

```typescript
interface ApiResponse<T> {
  readonly success: boolean
  readonly data: T | null
  readonly error: string | null
}

// Success
return c.json<ApiResponse<ItemData>>({ success: true, data, error: null })

// Error
return c.json<ApiResponse<null>>(
  { success: false, data: null, error: 'Validation failed' },
  400,
)
```

## Error Handling

```typescript
app.post('/', async (c) => {
  const body = await c.req.json<CreatePayload>()

  if (!body.name || typeof body.value !== 'number') {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'name and value are required' },
      400,
    )
  }

  const data = await repo.create(body)
  return c.json<ApiResponse<MyData>>({ success: true, data, error: null }, 201)
})
```

## Middleware

```typescript
import type { MiddlewareHandler } from 'hono'

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  log('info', `${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`)
}

// Usage
app.use('*', requestLogger)
```

## Logging

```typescript
import { log } from './middleware/logger.js'

// NEVER use console.log — use structured logger
log('info', 'Server started')
log('error', `Migration failed: ${error}`)
```

## Graceful Shutdown

```typescript
import { registerCleanupHandler, setupShutdownHandlers } from './shutdown.js'

setupShutdownHandlers()
registerCleanupHandler(async () => {
  await closeDatabase()
})
```

## Environment Variables

```typescript
// Access via process.env with bracket notation
const PORT = Number(process.env['PORT'] ?? 3001)
const DATABASE_URL = process.env['DATABASE_URL']

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}
```

## Server Entry Point Pattern

```typescript
// src/server/index.ts
setupShutdownHandlers()
await runMigrations()
registerCleanupHandler(async () => await closeDatabase())

const repo = new MyRepository(db)
const app = new Hono()
app.use('*', requestLogger)
app.get('/api/health', healthHandler)
app.route('/api/items', createItemRoutes(repo))

serve({ fetch: app.fetch, port: PORT })
```
