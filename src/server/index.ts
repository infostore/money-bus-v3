import { existsSync } from 'node:fs'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { db, runMigrations, checkConnection, closeDatabase } from './database/setup.js'
import { ItemRepository, SettingsRepository } from './database/repositories.js'
import { FamilyMemberRepository } from './database/family-member-repository.js'
import { InstitutionRepository } from './database/institution-repository.js'
import { createItemRoutes } from './routes/items.js'
import { createFamilyMemberRoutes } from './routes/family-members.js'
import { createInstitutionRoutes } from './routes/institutions.js'
import { requestLogger, log } from './middleware/logger.js'
import { registerCleanupHandler, setupShutdownHandlers } from './shutdown.js'
import type { ApiResponse } from '../shared/types.js'

const PORT = Number(process.env['PORT'] ?? 3001)

setupShutdownHandlers()

try {
  await runMigrations()
  log('info', 'Database migrations completed')
} catch (error) {
  log('error', `Migration failed: ${error}`)
  process.exit(1)
}

registerCleanupHandler(async () => {
  log('info', 'Closing database connection pool...')
  await closeDatabase()
})

const itemRepo = new ItemRepository(db)
const settingsRepo = new SettingsRepository(db)
const familyMemberRepo = new FamilyMemberRepository(db)
const institutionRepo = new InstitutionRepository(db)

try {
  const institutionCount = await institutionRepo.count()
  if (institutionCount === 0) {
    await institutionRepo.seed()
    log('info', 'Default institutions seeded (25 records)')
  }
} catch (error) {
  log('error', `Institution seed failed: ${error}`)
}


const app = new Hono()

app.use('*', requestLogger)

app.get('/api/health', async (c) => {
  const dbHealthy = await checkConnection().catch(() => false)
  const status = dbHealthy ? 'healthy' : 'unhealthy'
  const statusCode = dbHealthy ? 200 : 503

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealthy ? 'connected' : 'disconnected',
  }, statusCode)
})

app.route('/api/items', createItemRoutes(itemRepo))
app.route('/api/family-members', createFamilyMemberRoutes(familyMemberRepo))
app.route('/api/institutions', createInstitutionRoutes(institutionRepo))

app.get('/api/settings', async (c) => {
  const data = await settingsRepo.getAll()
  return c.json<ApiResponse<Record<string, string>>>({ success: true, data, error: null })
})

app.post('/api/settings', async (c) => {
  const body = await c.req.json<{ key: string; value: string }>()

  if (!body.key || typeof body.value !== 'string') {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'key and value (string) are required' },
      400,
    )
  }

  await settingsRepo.set(body.key, body.value)
  return c.json<ApiResponse<boolean>>({ success: true, data: true, error: null })
})

if (existsSync('./dist/client')) {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ root: './dist/client', path: 'index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  log('info', `Server running at http://localhost:${info.port}`)
})
