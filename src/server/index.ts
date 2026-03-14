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
import { AccountRepository } from './database/account-repository.js'
import { syncInitialData } from './database/initial-data-loader.js'
import { PriceHistoryRepository } from './database/price-history-repository.js'
import { ScheduledTaskRepository } from './database/scheduled-task-repository.js'
import { TaskExecutionRepository } from './database/task-execution-repository.js'
import { NaverFinanceAdapter } from './scheduler/naver-finance-adapter.js'
import { YahooFinanceAdapter } from './scheduler/yahoo-finance-adapter.js'
import { PriceCollectorService } from './scheduler/price-collector-service.js'
import { EtfProfileRepository } from './database/etf-profile-repository.js'
import { EtfComponentRepository } from './database/etf-component-repository.js'
import { SamsungActiveAdapter } from './scheduler/samsung-active-adapter.js'
import { TimefolioAdapter } from './scheduler/timefolio-adapter.js'
import { RiseAdapter } from './scheduler/rise-adapter.js'
import { KodexAdapter } from './scheduler/kodex-adapter.js'
import { EtfComponentCollectorService } from './scheduler/etf-component-collector-service.js'
import type { EtfComponentAdapter } from './scheduler/etf-component-adapter.js'
import { ExchangeRateRepository } from './database/exchange-rate-repository.js'
import { ExchangeRateFetcher } from './services/exchange-rate-fetcher.js'
import { ExchangeRateCollectorService } from './scheduler/exchange-rate-collector-service.js'
import { HoldingsPriceCollectorService } from './scheduler/holdings-price-collector-service.js'
import { startSchedulers } from './scheduler/index.js'
import { createHoldingsPriceSchedulerRoutes } from './routes/holdings-price-scheduler.js'
import { createItemRoutes } from './routes/items.js'
import { createFamilyMemberRoutes } from './routes/family-members.js'
import { createInstitutionRoutes } from './routes/institutions.js'
import { createAccountTypeRoutes } from './routes/account-types.js'
import { createProductRoutes } from './routes/products.js'
import { createAccountRoutes } from './routes/accounts.js'
import { createSchedulerRoutes } from './routes/scheduler.js'
import { createEtfSchedulerRoutes } from './routes/etf-component-scheduler.js'
import { createEtfComponentRoutes } from './routes/etf-components.js'
import { createExchangeRateRoutes } from './routes/exchange-rates.js'
import { createExchangeRateSchedulerRoutes } from './routes/exchange-rate-scheduler.js'
import { TransactionRepository } from './database/transaction-repository.js'
import { HoldingService } from './services/holding-service.js'
import { createTransactionRoutes } from './routes/transactions.js'
import { createHoldingsRoutes } from './routes/holdings.js'
import { requestLogger, log } from './middleware/logger.js'
import { registerCleanupHandler, setupShutdownHandlers } from './shutdown.js'
import type { ApiResponse, EtfManager } from '../shared/types.js'

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
const accountRepo = new AccountRepository(db)

// PRD-FEAT-006: Bidirectional sync with initial data SQLite file
try {
  const result = await syncInitialData(db, './data/initial.db')
  const { familyMembers: fm, institutions: inst, accountTypes: at, accounts: acc, products: prod, etfProfiles: etf } = result
  const tables = [fm, inst, at, acc, prod, etf]
  const totalChanges = tables.reduce((sum, t) => sum + t.pgInserted + t.pgUpdated + t.sqliteInserted + t.sqliteUpdated, 0)

  if (totalChanges > 0) {
    const fmt = (label: string, t: typeof fm) => `${label}(pg+${t.pgInserted}/↑${t.pgUpdated}, sl+${t.sqliteInserted}/↑${t.sqliteUpdated})`
    log('info', `Initial data sync completed: ${fmt('family_members', fm)}, ${fmt('institutions', inst)}, ${fmt('account_types', at)}, ${fmt('accounts', acc)}, ${fmt('products', prod)}, ${fmt('etf_profiles', etf)}`)
  } else {
    log('info', 'Initial data sync: already in sync')
  }
} catch (error) {
  log('error', `Initial data sync failed: ${error}`)
}

// PRD-FEAT-005: Price Scheduler setup
const priceHistoryRepo = new PriceHistoryRepository(db)
const scheduledTaskRepo = new ScheduledTaskRepository(db)
const taskExecutionRepo = new TaskExecutionRepository(db)

let naverAdapter: NaverFinanceAdapter | null = null
let yahooAdapter: YahooFinanceAdapter | null = null

let collectorService: PriceCollectorService | undefined
let schedulerTaskId = 0
try {
  naverAdapter = new NaverFinanceAdapter()
  const { default: YahooFinance } = await import('yahoo-finance2')
  const yahooClient = new YahooFinance({ suppressNotices: ['ripHistorical'] })
  yahooAdapter = new YahooFinanceAdapter(yahooClient as never)

  const task = await scheduledTaskRepo.seedDefault({
    name: 'price-collection-daily',
    cronExpression: '0 20 * * *',
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

  log('info', 'Price scheduler initialized')
} catch (error) {
  log('error', `Price scheduler setup failed: ${error}`)
}

// PRD-FEAT-012: ETF Component Collection Scheduler
const etfProfileRepo = new EtfProfileRepository(db)
const etfComponentRepo = new EtfComponentRepository(db)

let etfCollectorService: EtfComponentCollectorService | null = null
let etfSchedulerTaskId = 0
try {
  const etfTask = await scheduledTaskRepo.seedDefault({
    name: 'etf-component-collection-daily',
    cronExpression: '0 21 * * *',
    enabled: true,
  })
  etfSchedulerTaskId = etfTask.id

  const adapters = new Map<EtfManager, EtfComponentAdapter>([
    ['samsung-active', new SamsungActiveAdapter()],
    ['timefolio', new TimefolioAdapter()],
    ['rise', new RiseAdapter()],
    ['kodex', new KodexAdapter()],
  ])

  etfCollectorService = new EtfComponentCollectorService(
    etfProfileRepo,
    etfComponentRepo,
    taskExecutionRepo,
    adapters,
    etfTask.id,
  )

  log('info', 'ETF component scheduler initialized')
} catch (error) {
  log('error', `ETF scheduler setup failed: ${error}`)
}

// PRD-FEAT-016: Exchange Rate Collection Scheduler
const exchangeRateRepo = new ExchangeRateRepository(db)

let exchangeRateCollectorService: ExchangeRateCollectorService | null = null
let exchangeRateTaskId = 0
try {
  const exchangeRateTask = await scheduledTaskRepo.seedDefault({
    name: 'exchange-rate-collection-daily',
    cronExpression: '0 9 * * *',
    enabled: true,
  })
  exchangeRateTaskId = exchangeRateTask.id

  const exchangeRateFetcher = new ExchangeRateFetcher(exchangeRateRepo)

  exchangeRateCollectorService = new ExchangeRateCollectorService(
    exchangeRateFetcher,
    taskExecutionRepo,
    exchangeRateTask.id,
  )

  log('info', 'Exchange rate scheduler initialized')
} catch (error) {
  log('error', `Exchange rate scheduler setup failed: ${error}`)
}

// PRD-FEAT-017: Holdings Price Collection Scheduler
let holdingsPriceService: HoldingsPriceCollectorService | null = null
let holdingsDomesticTaskId = 0
let holdingsForeignTaskId = 0
try {
  if (naverAdapter && yahooAdapter) {
    const domesticTask = await scheduledTaskRepo.seedDefault({
      name: 'holdings-price-domestic',
      cronExpression: '0 0-7 * * 1-5',
      enabled: true,
    })
    const foreignTask = await scheduledTaskRepo.seedDefault({
      name: 'holdings-price-foreign',
      cronExpression: '0 22 * * 1-5',
      enabled: true,
    })
    holdingsDomesticTaskId = domesticTask.id
    holdingsForeignTaskId = foreignTask.id

    holdingsPriceService = new HoldingsPriceCollectorService(
      productRepo,
      priceHistoryRepo,
      taskExecutionRepo,
      naverAdapter,
      yahooAdapter,
      domesticTask.id,
      foreignTask.id,
    )

    log('info', 'Holdings price scheduler initialized')
  } else {
    log('warn', 'Holdings price scheduler skipped: adapters not available')
  }
} catch (error) {
  log('error', `Holdings price scheduler setup failed: ${error}`)
}

// Start cron schedulers after all services are constructed
if (collectorService) {
  try {
    await startSchedulers(
      scheduledTaskRepo,
      taskExecutionRepo,
      collectorService,
      etfCollectorService,
      exchangeRateCollectorService,
      holdingsPriceService,
    )
  } catch (error) {
    log('error', `Scheduler startup failed: ${error}`)
  }
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
app.route('/api/products', createProductRoutes(productRepo, priceHistoryRepo))
app.route('/api/accounts', createAccountRoutes(accountRepo))

// PRD-FEAT-014: Holdings Management
const transactionRepo = new TransactionRepository(db)
const holdingService = new HoldingService(db, priceHistoryRepo, exchangeRateRepo)
app.route('/api/transactions', createTransactionRoutes(transactionRepo, holdingService))
app.route('/api/holdings', createHoldingsRoutes(holdingService))

if (collectorService && schedulerTaskId > 0) {
  app.route(
    '/api/scheduler/price-collection',
    createSchedulerRoutes(collectorService, taskExecutionRepo, schedulerTaskId),
  )
} else {
  app.get('/api/scheduler/price-collection/status', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.post('/api/scheduler/price-collection/run', (c) =>
    c.json<ApiResponse<null>>(
      { success: false, data: null, error: '스케줄러가 초기화되지 않았습니다' },
      503,
    ),
  )
}

// PRD-FEAT-012: ETF component routes
app.route('/api/etf-components', createEtfComponentRoutes(etfComponentRepo))

if (etfCollectorService && etfSchedulerTaskId > 0) {
  app.route(
    '/api/scheduler/etf-components',
    createEtfSchedulerRoutes(etfCollectorService, taskExecutionRepo, etfSchedulerTaskId),
  )
} else {
  app.get('/api/scheduler/etf-components/status', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.post('/api/scheduler/etf-components/run', (c) =>
    c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'ETF 스케줄러가 초기화되지 않았습니다' },
      503,
    ),
  )
}

// PRD-FEAT-016: Exchange rate routes
if (exchangeRateCollectorService && exchangeRateTaskId > 0) {
  const exchangeRateFetcherForRoutes = new ExchangeRateFetcher(exchangeRateRepo)
  app.route('/api/exchange-rates', createExchangeRateRoutes(exchangeRateRepo, exchangeRateFetcherForRoutes))
  app.route(
    '/api/scheduler/exchange-rate',
    createExchangeRateSchedulerRoutes(exchangeRateCollectorService, taskExecutionRepo, exchangeRateTaskId),
  )
} else {
  app.get('/api/exchange-rates', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.get('/api/scheduler/exchange-rate/status', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.post('/api/scheduler/exchange-rate/run', (c) =>
    c.json<ApiResponse<null>>(
      { success: false, data: null, error: '환율 스케줄러가 초기화되지 않았습니다' },
      503,
    ),
  )
}

// PRD-FEAT-017: Holdings price scheduler routes
if (holdingsPriceService && holdingsDomesticTaskId > 0 && holdingsForeignTaskId > 0) {
  app.route(
    '/api/scheduler/holdings-price',
    createHoldingsPriceSchedulerRoutes(
      holdingsPriceService,
      taskExecutionRepo,
      holdingsDomesticTaskId,
      holdingsForeignTaskId,
    ),
  )
} else {
  app.get('/api/scheduler/holdings-price/status', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.post('/api/scheduler/holdings-price/run', (c) =>
    c.json<ApiResponse<null>>(
      { success: false, data: null, error: '보유종목 가격수집 스케줄러가 초기화되지 않았습니다' },
      503,
    ),
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
