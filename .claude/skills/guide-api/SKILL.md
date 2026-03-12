---
name: guide-api
description: Hono API route patterns, response format, error handling, and middleware conventions
user-invocable: false
---

# API Conventions

## Route File Pattern

Each domain gets a dedicated file in `src/server/routes/`. Export a factory function that accepts repositories via dependency injection.

```typescript
// src/server/routes/things.ts
export function createThingRoutes(things: ThingRepository): Hono {
  const app = new Hono()

  // 1. Specific routes FIRST (prevent /:id shadowing)
  app.get('/summary', (c) => { ... })
  app.get('/analytics', (c) => { ... })

  // 2. Collection routes
  app.get('/', (c) => { ... })
  app.post('/', async (c) => { ... })

  // 3. Wildcard routes LAST
  app.get('/:id', (c) => { ... })
  app.put('/:id', async (c) => { ... })
  app.delete('/:id', (c) => { ... })

  return app
}
```

Register in `src/server/index.ts`:

```typescript
app.route('/api/things', createThingRoutes(thingRepo))
```

## Response Format

All endpoints return `ApiResponse<T>` from `src/shared/types.ts`:

```typescript
// Success
return c.json<ApiResponse<Thing>>({ success: true, data, error: null })
return c.json<ApiResponse<Thing>>({ success: true, data, error: null }, 201) // created

// Error
return c.json<ApiResponse<null>>(
  { success: false, data: null, error: 'Thing not found' },
  404,
)
```

Status codes: 200 (default), 201 (created), 400 (bad input), 404 (not found), 409 (conflict), 500 (server).

## Input Validation Pattern

```typescript
// 1. ID parsing
const id = Number(c.req.param('id'))
if (isNaN(id)) {
  return c.json<ApiResponse<null>>({ success: false, data: null, error: 'Invalid id' }, 400)
}

// 2. Body validation
const body = await c.req.json<CreateThingPayload>()
if (!body.name || typeof body.name !== 'string') {
  return c.json<ApiResponse<null>>({ success: false, data: null, error: 'name (string) is required' }, 400)
}

// 3. Query parameter validation
const yearStr = c.req.query('year')
if (!yearStr) {
  return c.json<ApiResponse<null>>({ success: false, data: null, error: 'year is required' }, 400)
}
```

## Error Handling (try/catch)

```typescript
try {
  const data = repo.create(input)
  return c.json<ApiResponse<Thing>>({ success: true, data, error: null }, 201)
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('UNIQUE constraint')) {
      return c.json<ApiResponse<null>>({ success: false, data: null, error: 'Already exists' }, 409)
    }
    if (error.message.includes('FOREIGN KEY constraint')) {
      return c.json<ApiResponse<null>>({ success: false, data: null, error: 'Invalid reference' }, 400)
    }
  }
  throw error // re-throw unknown errors
}
```

## Middleware

Global request logger in `src/server/middleware/logger.ts` uses `process.stdout.write()` (not console.log). Applied via `app.use('*', requestLogger)`.
