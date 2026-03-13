// PRD-FEAT-005: Price History Scheduler
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PriceCollectorService } from '../../src/server/scheduler/price-collector-service.js'
import type { Product, TaskExecution } from '../../src/shared/types.js'
import type { PriceRow } from '../../src/server/database/price-history-repository.js'

// Mock withRetry to pass through directly (no delays)
vi.mock('../../src/server/scheduler/with-retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

// Mock logger to suppress output
vi.mock('../../src/server/middleware/logger.js', () => ({
  log: vi.fn(),
}))

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
    task_id: 1,
    started_at: '2026-03-13T00:00:00.000Z',
    finished_at: null,
    status: 'running',
    products_total: 0,
    products_succeeded: 0,
    products_failed: 0,
    products_skipped: 0,
    message: null,
    created_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  }
}

function createMocks() {
  const productRepo = {
    findAll: vi.fn<() => Promise<readonly Product[]>>().mockResolvedValue([]),
  }

  const priceHistoryRepo = {
    upsertMany: vi.fn<(rows: readonly PriceRow[]) => Promise<number>>().mockResolvedValue(0),
    findLastDate: vi.fn<(productId: number) => Promise<string | undefined>>().mockResolvedValue(undefined),
  }

  const taskExecutionRepo = {
    create: vi.fn().mockResolvedValue(makeExecution()),
    complete: vi.fn().mockImplementation(
      (_id: number, result: { status: string }) =>
        Promise.resolve(makeExecution({ status: result.status as TaskExecution['status'], finished_at: '2026-03-13T01:00:00.000Z' })),
    ),
    trimOldExecutions: vi.fn<(taskId: number, keep?: number) => Promise<number>>().mockResolvedValue(0),
    updateProgress: vi.fn().mockResolvedValue(undefined),
  }

  const naverAdapter = {
    fetchPrices: vi.fn<(code: string, productId: number, startDate: string, endDate: string) => Promise<readonly PriceRow[]>>().mockResolvedValue([]),
  }

  const yahooAdapter = {
    fetchPrices: vi.fn<(code: string, productId: number, startDate: Date, endDate: Date) => Promise<readonly PriceRow[]>>().mockResolvedValue([]),
  }

  return { productRepo, priceHistoryRepo, taskExecutionRepo, naverAdapter, yahooAdapter }
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new PriceCollectorService(
    mocks.productRepo as never,
    mocks.priceHistoryRepo as never,
    mocks.taskExecutionRepo as never,
    mocks.naverAdapter as never,
    mocks.yahooAdapter as never,
    1, // taskId
  )
}

describe('PriceCollectorService', () => {
  let mocks: ReturnType<typeof createMocks>
  let service: PriceCollectorService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'))
    mocks = createMocks()
    service = createService(mocks)
  })

  it('calls naverAdapter for domestic (KRX/KOSPI/KOSDAQ) products', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    mocks.naverAdapter.fetchPrices.mockResolvedValue([
      { productId: 1, date: '2026-03-12', open: '100', high: '110', low: '90', close: '105', volume: 1000 },
    ])

    await service.run()

    expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledTimes(1)
    expect(mocks.yahooAdapter.fetchPrices).not.toHaveBeenCalled()
  })

  it('calls yahooAdapter for foreign (NASDAQ/NYSE) products', async () => {
    const product = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ', currency: 'USD' })
    mocks.productRepo.findAll.mockResolvedValue([product])

    await service.run()

    expect(mocks.yahooAdapter.fetchPrices).toHaveBeenCalledTimes(1)
    expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
  })

  it('skips products with null code and counts them as skipped', async () => {
    const product = makeProduct({ id: 3, code: null, exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])

    const result = await service.run()

    expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
    expect(mocks.yahooAdapter.fetchPrices).not.toHaveBeenCalled()
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ productsSkipped: 1, productsTotal: 0 }),
    )
    expect(result).toBeDefined()
  })

  it('skips products with unknown exchange and counts them as skipped', async () => {
    const product = makeProduct({ id: 4, code: 'BTC', exchange: 'UPBIT' })
    mocks.productRepo.findAll.mockResolvedValue([product])

    await service.run()

    expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ productsSkipped: 1 }),
    )
  })

  it('calculates incremental date range from last collected date', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    mocks.priceHistoryRepo.findLastDate.mockResolvedValue('2026-03-10')

    await service.run()

    // startDate should be 2026-03-11 (lastDate + 1 day), endDate 2026-03-13 (today)
    expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledWith(
      '005930',
      1,
      '20260311',
      '20260313',
    )
  })

  it('uses default lookback when no history exists', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    mocks.priceHistoryRepo.findLastDate.mockResolvedValue(undefined)

    await service.run()

    // Default lookback 365 days from 2026-03-13
    expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledWith(
      '005930',
      1,
      '20250313',
      '20260313',
    )
  })

  it('skips product when startDate > endDate (already up to date)', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    // Last date is today — startDate would be tomorrow which > today
    mocks.priceHistoryRepo.findLastDate.mockResolvedValue('2026-03-13')

    await service.run()

    expect(mocks.naverAdapter.fetchPrices).not.toHaveBeenCalled()
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ productsTotal: 1, productsSkipped: 1 }),
    )
  })

  it('handles per-product failure without aborting remaining products', async () => {
    const p1 = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    const p2 = makeProduct({ id: 2, code: '000660', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([p1, p2])
    mocks.naverAdapter.fetchPrices
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([
        { productId: 2, date: '2026-03-12', open: '100', high: '110', low: '90', close: '105', volume: 500 },
      ])

    const result = await service.run()

    expect(mocks.naverAdapter.fetchPrices).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('partial')
  })

  it('returns success when all products succeed', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    mocks.naverAdapter.fetchPrices.mockResolvedValue([
      { productId: 1, date: '2026-03-12', open: '100', high: '110', low: '90', close: '105', volume: 1000 },
    ])

    const result = await service.run()

    expect(result.status).toBe('success')
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'success', productsSucceeded: 1, productsFailed: 0 }),
    )
  })

  it('returns partial when some products fail', async () => {
    const p1 = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    const p2 = makeProduct({ id: 2, code: '000660', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([p1, p2])
    mocks.naverAdapter.fetchPrices
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([])

    const result = await service.run()

    expect(result.status).toBe('partial')
  })

  it('returns failed when all products fail', async () => {
    const p1 = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    const p2 = makeProduct({ id: 2, code: '000660', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([p1, p2])
    mocks.naverAdapter.fetchPrices.mockRejectedValue(new Error('fail'))

    const result = await service.run()

    expect(result.status).toBe('failed')
  })

  it('creates and completes execution record', async () => {
    mocks.productRepo.findAll.mockResolvedValue([])

    await service.run()

    expect(mocks.taskExecutionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 1 }),
    )
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledTimes(1)
  })

  it('trims old executions after completion', async () => {
    mocks.productRepo.findAll.mockResolvedValue([])

    await service.run()

    expect(mocks.taskExecutionRepo.trimOldExecutions).toHaveBeenCalledWith(1)
  })

  it('throws when already running', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])

    // Make the first run hang
    let resolveFirst: () => void = () => {}
    mocks.naverAdapter.fetchPrices.mockReturnValue(
      new Promise<readonly PriceRow[]>((resolve) => {
        resolveFirst = () => resolve([])
      }),
    )

    const firstRun = service.run()

    await expect(service.run()).rejects.toThrow('Collection is already running')

    // Clean up
    resolveFirst()
    await firstRun
  })

  it('resets isRunning after completion', async () => {
    mocks.productRepo.findAll.mockResolvedValue([])

    await service.run()

    expect(service.running).toBe(false)
  })

  it('resets isRunning even when run fails with error', async () => {
    mocks.taskExecutionRepo.create.mockRejectedValue(new Error('db error'))

    await expect(service.run()).rejects.toThrow('db error')

    expect(service.running).toBe(false)
  })

  // PRD-FEAT-009: Abort behavior
  it('aborts execution and returns aborted status', async () => {
    const p1 = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    const p2 = makeProduct({ id: 2, code: '000660', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([p1, p2])
    // First product succeeds, then we abort before second
    mocks.naverAdapter.fetchPrices
      .mockImplementationOnce(async () => {
        service.abort()
        return [{ productId: 1, date: '2026-03-12', open: '100', high: '110', low: '90', close: '105', volume: 1000 }]
      })

    const result = await service.run()

    expect(result.status).toBe('aborted')
    expect(mocks.taskExecutionRepo.complete).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'aborted', message: '사용자 요청으로 중지됨' }),
    )
  })

  it('resets isRunning and abortController after abort', async () => {
    mocks.productRepo.findAll.mockResolvedValue([makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })])
    mocks.naverAdapter.fetchPrices.mockImplementation(async () => {
      service.abort()
      return []
    })

    await service.run()

    expect(service.running).toBe(false)
  })

  it('abort() is safe to call when not running', () => {
    expect(() => service.abort()).not.toThrow()
  })

  it('upserts fetched price rows into priceHistoryRepo', async () => {
    const product = makeProduct({ id: 1, code: '005930', exchange: 'KOSPI' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    const priceRows: readonly PriceRow[] = [
      { productId: 1, date: '2026-03-12', open: '100', high: '110', low: '90', close: '105', volume: 1000 },
    ]
    mocks.naverAdapter.fetchPrices.mockResolvedValue(priceRows)

    await service.run()

    expect(mocks.priceHistoryRepo.upsertMany).toHaveBeenCalledWith(priceRows)
  })

  it('passes Date objects to yahooAdapter', async () => {
    const product = makeProduct({ id: 2, code: 'AAPL', exchange: 'NASDAQ', currency: 'USD' })
    mocks.productRepo.findAll.mockResolvedValue([product])
    mocks.priceHistoryRepo.findLastDate.mockResolvedValue('2026-03-10')

    await service.run()

    const [, , startDate, endDate] = mocks.yahooAdapter.fetchPrices.mock.calls[0]
    expect(startDate).toBeInstanceOf(Date)
    expect(endDate).toBeInstanceOf(Date)
    expect(startDate.toISOString().slice(0, 10)).toBe('2026-03-11')
    expect(endDate.toISOString().slice(0, 10)).toBe('2026-03-13')
  })

  it('returns success status when no products exist (empty run)', async () => {
    mocks.productRepo.findAll.mockResolvedValue([])

    const result = await service.run()

    expect(result.status).toBe('success')
  })
})
