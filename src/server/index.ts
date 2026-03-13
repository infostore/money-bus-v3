import { existsSync } from 'node:fs'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { db, runMigrations, checkConnection, closeDatabase } from './database/setup.js'
import { ItemRepository, SettingsRepository } from './database/repositories.js'
import { FamilyMemberRepository } from './database/family-member-repository.js'
import { InstitutionRepository } from './database/institution-repository.js'
import { AccountTypeRepository } from './database/account-type-repository.js'
import { ProductRepository } from './database/product-repository.js'
import { PriceHistoryRepository } from './database/price-history-repository.js'
import { ScheduledTaskRepository } from './database/scheduled-task-repository.js'
import { TaskExecutionRepository } from './database/task-execution-repository.js'
import { NaverFinanceAdapter } from './scheduler/naver-finance-adapter.js'
import { YahooFinanceAdapter } from './scheduler/yahoo-finance-adapter.js'
import { PriceCollectorService } from './scheduler/price-collector-service.js'
import { startSchedulers } from './scheduler/index.js'
import { createItemRoutes } from './routes/items.js'
import { createFamilyMemberRoutes } from './routes/family-members.js'
import { createInstitutionRoutes } from './routes/institutions.js'
import { createAccountTypeRoutes } from './routes/account-types.js'
import { createProductRoutes } from './routes/products.js'
import { createSchedulerRoutes } from './routes/scheduler.js'
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
const accountTypeRepo = new AccountTypeRepository(db)
const productRepo = new ProductRepository(db)

try {
  const institutionCount = await institutionRepo.count()
  if (institutionCount === 0) {
    await institutionRepo.seed()
    log('info', 'Default institutions seeded (25 records)')
  }
} catch (error) {
  log('error', `Institution seed failed: ${error}`)
}

try {
  const accountTypeCount = await accountTypeRepo.count()
  if (accountTypeCount === 0) {
    await accountTypeRepo.seed()
    log('info', 'Default account types seeded (13 records)')
  }
} catch (error) {
  log('error', `Account type seed failed: ${error}`)
}

try {
  const productCount = await productRepo.count()
  if (productCount === 0) {
    await productRepo.seed()
    log('info', 'Default products seeded (15 records)')
  }
} catch (error) {
  log('error', `Product seed failed: ${error}`)
}

// PRD-FEAT-005: Price Scheduler setup
const priceHistoryRepo = new PriceHistoryRepository(db)
const scheduledTaskRepo = new ScheduledTaskRepository(db)
const taskExecutionRepo = new TaskExecutionRepository(db)
const naverAdapter = new NaverFinanceAdapter()
const yahooModule = await import('yahoo-finance2')
const yahooAdapter = new YahooFinanceAdapter(yahooModule.default as never)

let collectorService: PriceCollectorService | undefined
let schedulerTaskId = 0
try {
  const task = await scheduledTaskRepo.seedDefault({
    name: 'price-collection-daily',
    cronExpression: '0 11 * * *',
    enabled: true,
  })
  schedulerTaskId = task.id

  collectorService = new PriceCollectorService(
    productRepo,
    priceHistoryRepo,
    taskExecutionRepo,
    naverAdapter,
    yahooAdapter,
    task.id,
  )

  await startSchedulers(scheduledTaskRepo, taskExecutionRepo, collectorService)
  log('info', 'Price scheduler initialized')
} catch (error) {
  log('error', `Scheduler setup failed: ${error}`)
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
app.route('/api/account-types', createAccountTypeRoutes(accountTypeRepo))
app.route('/api/products', createProductRoutes(productRepo))

if (collectorService && schedulerTaskId > 0) {
  app.route(
    '/api/scheduler/price-collection',
    createSchedulerRoutes(collectorService, taskExecutionRepo, schedulerTaskId),
  )
}

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
