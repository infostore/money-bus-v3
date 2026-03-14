// PRD-FEAT-017: Holdings Price Collection Scheduler
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HoldingsPriceCollectorService } from '../../src/server/scheduler/holdings-price-collector-service.js'
import type { Product, TaskExecution } from '../../src/shared/types.js'
import type { PriceRow } from '../../src/server/database/price-history-repository.js'

vi.mock('../../src/server/middleware/logger.js', () => ({ log: vi.fn() }))
vi.mock('../../src/server/scheduler/with-retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

const DOMESTIC_TASK_ID = 10
const FOREIGN_TASK_ID = 20

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Test Product',
    code: '005930',
    asset_type: '주식',
    currency: 'KRW',
    exchange: 'KOSPI',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeExecution(overrides: Partial<TaskExecution> = {}): TaskExecution {
  return {
    id: 1,
    task_id: DOMESTIC_TASK_ID,
    started_at: '2026-03-14T00:00:00.000Z',
    finished_at: null,
    status: 'running',
    products_total: 0,
    products_succeeded: 0,
    products_failed: 0,
    products_skipped: 0,
    message: null,
    created_at: '2026-03-14T00:00:00.000Z',
    ...overrides,
  }
}

const samplePriceRows: readonly PriceRow[] = [
  {
    productId: 1,
    date: '2026-03-14',
    open: '70000',
    high: '71000',
    low: '69000',
    close: '70500',
    volume: 1000,
  },
]

function createMocks() {
  const productRepo = {
    findWithActiveHoldings: vi.fn<() => Promise<readonly Product[]>>().mockResolvedValue([]),
  }

  const priceHistoryRepo = {
    upsertMany: vi.fn<(rows: readonly PriceRow[]) => Promise<number>>().mockResolvedValue(1),
  }

  const taskExecutionRepo = {
    create: vi.fn().mockResolvedValue(makeExecution()),
    complete: vi.fn().mockImplementation(
      (
        _id: number,
        result: {
          status: string
          productsTotal: number
          productsSucceeded: number
          productsFailed: number
          productsSkipped: number
          message: string | null
        },
      ) =>
        Promise.resolve(
          makeExecution({
            status: result.status as TaskExecution['status'],
            finished_at: '2026-03-14T01:00:00.000Z',
            products_total: result.productsTotal,
            products_succeeded: result.productsSucceeded,
            products_failed: result.productsFailed,
            products_skipped: result.productsSkipped,
            message: result.message,
          }),
        ),
    ),
    trimOldExecutions: vi.fn<(taskId: number) => Promise<number>>().mockResolvedValue(0),
  }

  const naverAdapter = {
    fetchPrices: vi
      .fn<(code: string, productId: number, startDate: string, endDate: string) => Promise<readonly PriceRow[]>>()
      .mockResolvedValue(samplePriceRows),
  }

  const yahooAdapter = {
    fetchPrices: vi
      .fn<(code: string, productId: number, startDate: Date, endDate: Date) => Promise<readonly PriceRow[]>>()
      .mockResolvedValue(samplePriceRows),
  }

  return { productRepo, priceHistoryRepo, taskExecutionRepo, naverAdapter, yahooAdapter }
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new HoldingsPriceCollectorService(
    mocks.productRepo as never,
    mocks.priceHistoryRepo as never,
    mocks.taskExecutionRepo as never,
    mocks.naverAdapter as never,
    mocks.yahooAdapter as never,
    DOMESTIC_TASK_ID,
    FOREIGN_TASK_ID,
  )
}

describe('HoldingsPriceCollectorService', () => {
  let mocks: ReturnType<typeof createMocks>
  let service: HoldingsPriceCollectorService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T09:00:00.000Z'))
    mocks = createMocks()
    service = createService(mocks)
  })

  describe('scope filtering', () => {
    it('run("domestic") only processes Naver-mapped (domestic) products', async () => {
      const domestic = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
      const foreign = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([domestic, foreign])

      await service.run('domestic')

      expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledTimes(1)
      expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledWith('005930', 1, '20260314', '20260314')
      expect(mocks.yahooAdapter.fetchPrices).not.toHaveBeenCalled()
    })

    it('run("foreign") only processes Yahoo-mapped (foreign) products', async () => {
      const domestic = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
      const foreign = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([domestic, foreign])

      await service.run('foreign')

      expect(mocks.yahooAdapter.fetchPrices).toHaveBeenCalledTimes(1)
      expect(mocks.yahooAdapter.fetchPrices).toHaveBeenCalledWith(
        'AAPL',
        2,
        new Date('2026-03-14T00:00:00.000Z'),
        new Date('2026-03-14T00:00:00.000Z'),
      )
      expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
    })

    it('run("all") processes all held products across both adapters', async () => {
      const domestic = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
      const foreign = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([domestic, foreign])

      await service.run('all')

      expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledTimes(1)
      expect(mocks.yahooAdapter.fetchPrices).toHaveBeenCalledTimes(1)
    })
  })

  describe('today-only date range', () => {
    it('calls Naver adapter with today compact date for both start and end', async () => {
      const product = makeProduct({ exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])

      await service.run('domestic')

      expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledWith(
        product.code,
        product.id,
        '20260314',
        '20260314',
      )
    })

    it('calls Yahoo adapter with today Date objects for both start and end', async () => {
      const product = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])

      await service.run('foreign')

      const expectedDate = new Date('2026-03-14T00:00:00.000Z')
      expect(mocks.yahooAdapter.fetchPrices).toHaveBeenCalledWith(
        'AAPL',
        2,
        expectedDate,
        expectedDate,
      )
    })
  })

  describe('running getter', () => {
    it('running is false before and after run', async () => {
      expect(service.running).toBe(false)
      await service.run('all')
      expect(service.running).toBe(false)
    })

    it('running is true during execution', async () => {
      let capturedRunning = false
      mocks.taskExecutionRepo.create.mockImplementation(async () => {
        capturedRunning = service.running
        return makeExecution()
      })

      await service.run('all')

      expect(capturedRunning).toBe(true)
    })
  })

  describe('concurrent run prevention', () => {
    it('throws when called while already running', async () => {
      let resolveCreate!: (value: TaskExecution) => void
      mocks.taskExecutionRepo.create.mockReturnValue(
        new Promise<TaskExecution>((resolve) => { resolveCreate = resolve }),
      )

      const firstRun = service.run('all')
      // yield to let first run start
      await Promise.resolve()

      await expect(service.run('all')).rejects.toThrow(
        'Holdings price collection is already running',
      )

      resolveCreate(makeExecution())
      await firstRun
    })
  })

  describe('product skipping', () => {
    it('skips products with null code', async () => {
      const product = makeProduct({ code: null })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])

      const result = await service.run('all')

      expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
      expect(mocks.yahooAdapter.fetchPrices).not.toHaveBeenCalled()
      expect(result.products_skipped).toBe(1)
    })

    it('skips products with unknown exchange', async () => {
      const product = makeProduct({ exchange: 'UNKNOWN_EXCHANGE' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])

      const result = await service.run('all')

      expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
      expect(result.products_skipped).toBe(1)
    })
  })

  describe('error handling', () => {
    it('marks product as failed on adapter error without crashing others', async () => {
      const failingProduct = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
      const successProduct = makeProduct({ id: 2, code: '000660', exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([failingProduct, successProduct])

      mocks.naverAdapter.fetchPrices
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(samplePriceRows)

      const result = await service.run('domestic')

      expect(result.products_failed).toBe(1)
      expect(result.products_succeeded).toBe(1)
      expect(result.status).toBe('partial')
    })
  })

  describe('empty holdings', () => {
    it('returns products_total=0 and status=success when no holdings', async () => {
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([])

      const result = await service.run('all')

      expect(result.products_total).toBe(0)
      expect(result.status).toBe('success')
    })
  })

  describe('task ID routing', () => {
    it('run("all") uses domesticTaskId for execution record', async () => {
      await service.run('all')

      expect(mocks.taskExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: DOMESTIC_TASK_ID }),
      )
    })

    it('run("domestic") uses domesticTaskId for execution record', async () => {
      await service.run('domestic')

      expect(mocks.taskExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: DOMESTIC_TASK_ID }),
      )
    })

    it('run("foreign") uses foreignTaskId for execution record', async () => {
      await service.run('foreign')

      expect(mocks.taskExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: FOREIGN_TASK_ID }),
      )
    })

    it('trimOldExecutions called with correct taskId after domestic run', async () => {
      await service.run('domestic')

      expect(mocks.taskExecutionRepo.trimOldExecutions).toHaveBeenCalledWith(DOMESTIC_TASK_ID)
    })

    it('trimOldExecutions called with foreignTaskId after foreign run', async () => {
      await service.run('foreign')

      expect(mocks.taskExecutionRepo.trimOldExecutions).toHaveBeenCalledWith(FOREIGN_TASK_ID)
    })
  })

  describe('upsertMany behavior', () => {
    it('calls upsertMany when rows are returned', async () => {
      const product = makeProduct({ exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])
      mocks.naverAdapter.fetchPrices.mockResolvedValue(samplePriceRows)

      await service.run('domestic')

      expect(mocks.priceHistoryRepo.upsertMany).toHaveBeenCalledWith(samplePriceRows)
    })

    it('does not call upsertMany when adapter returns empty rows', async () => {
      const product = makeProduct({ exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])
      mocks.naverAdapter.fetchPrices.mockResolvedValue([])

      await service.run('domestic')

      expect(mocks.priceHistoryRepo.upsertMany).not.toHaveBeenCalled()
    })
  })

  describe('status calculation', () => {
    it('returns "success" when all products succeed', async () => {
      const product = makeProduct({ exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])
      mocks.naverAdapter.fetchPrices.mockResolvedValue(samplePriceRows)

      const result = await service.run('domestic')

      expect(result.status).toBe('success')
    })

    it('returns "failed" when all products fail', async () => {
      const product = makeProduct({ exchange: 'KOSPI' })
      mocks.productRepo.findWithActiveHoldings.mockResolvedValue([product])
      mocks.naverAdapter.fetchPrices.mockRejectedValue(new Error('fail'))

      const result = await service.run('domestic')

      expect(result.status).toBe('failed')
    })
  })
})
