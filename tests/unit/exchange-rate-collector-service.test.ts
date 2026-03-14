// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExchangeRateCollectorService } from '../../src/server/scheduler/exchange-rate-collector-service.js'
import type { TaskExecution } from '../../src/shared/types.js'
import type { ExchangeRate } from '../../src/shared/types.js'

vi.mock('../../src/server/middleware/logger.js', () => ({ log: vi.fn() }))

function makeExecution(overrides: Partial<TaskExecution> = {}): TaskExecution {
  return {
    id: 1,
    task_id: 10,
    started_at: '2026-03-14T00:00:00Z',
    finished_at: null,
    status: 'running',
    products_total: 0,
    products_succeeded: 0,
    products_failed: 0,
    products_skipped: 0,
    message: null,
    created_at: '2026-03-14T00:00:00Z',
    ...overrides,
  }
}

function makeExchangeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 1,
    currency: 'USD',
    rate: '1380.0000',
    updated_at: '2026-03-14T00:00:00Z',
    ...overrides,
  }
}

function createMocks() {
  const fetcher = {
    updateUsdRate: vi.fn().mockResolvedValue(makeExchangeRate()),
  }
  const taskExecutionRepo = {
    create: vi.fn().mockResolvedValue(makeExecution()),
    complete: vi.fn().mockImplementation(
      (_id: number, result: { status: string }) =>
        Promise.resolve(makeExecution({ status: result.status as TaskExecution['status'] })),
    ),
    trimOldExecutions: vi.fn().mockResolvedValue(0),
  }
  const detailRepo = {
    create: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue(undefined),
  }
  return { fetcher, taskExecutionRepo, detailRepo }
}

const TASK_ID = 10

describe('ExchangeRateCollectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('run() — success path', () => {
    it('creates an execution, calls fetcher.updateUsdRate, and completes with status=success', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      const result = await service.run()

      expect(taskExecutionRepo.create).toHaveBeenCalledOnce()
      expect(taskExecutionRepo.create).toHaveBeenCalledWith({
        taskId: TASK_ID,
        startedAt: expect.any(Date),
      })

      expect(fetcher.updateUsdRate).toHaveBeenCalledOnce()

      expect(taskExecutionRepo.complete).toHaveBeenCalledOnce()
      expect(taskExecutionRepo.complete).toHaveBeenCalledWith(
        1, // execution.id
        {
          status: 'success',
          productsTotal: 1,
          productsSucceeded: 1,
          productsFailed: 0,
          productsSkipped: 0,
          message: null,
        },
      )

      expect(result.status).toBe('success')
    })

    it('trims old executions after successful completion', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      await service.run()

      expect(taskExecutionRepo.trimOldExecutions).toHaveBeenCalledOnce()
      expect(taskExecutionRepo.trimOldExecutions).toHaveBeenCalledWith(TASK_ID)
    })
  })

  describe('run() — failure path', () => {
    it('completes with status=failed and error message when fetcher throws', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      fetcher.updateUsdRate.mockRejectedValue(new Error('Network timeout'))
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      const result = await service.run()

      expect(taskExecutionRepo.complete).toHaveBeenCalledWith(
        1,
        {
          status: 'failed',
          productsTotal: 1,
          productsSucceeded: 0,
          productsFailed: 1,
          productsSkipped: 0,
          message: 'Network timeout',
        },
      )
      expect(result.status).toBe('failed')
    })

    it('handles non-Error thrown values', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      fetcher.updateUsdRate.mockRejectedValue('string error')
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      await service.run()

      expect(taskExecutionRepo.complete).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'failed', message: 'string error' }),
      )
    })

    it('trims old executions after failed completion', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      fetcher.updateUsdRate.mockRejectedValue(new Error('fail'))
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      await service.run()

      expect(taskExecutionRepo.trimOldExecutions).toHaveBeenCalledOnce()
      expect(taskExecutionRepo.trimOldExecutions).toHaveBeenCalledWith(TASK_ID)
    })
  })

  describe('running getter', () => {
    it('returns false before run() is called', () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      expect(service.running).toBe(false)
    })

    it('returns true while run() is executing', async () => {
      const { taskExecutionRepo, detailRepo } = createMocks()
      let resolveUpdate!: () => void
      const fetcher = {
        updateUsdRate: vi.fn().mockImplementation(
          () => new Promise<ExchangeRate>((resolve) => {
            resolveUpdate = () => resolve(makeExchangeRate())
          }),
        ),
      }
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      const runPromise = service.run()
      // Wait for updateUsdRate to be called (isRunning = true)
      await vi.waitFor(() => expect(fetcher.updateUsdRate).toHaveBeenCalled())

      expect(service.running).toBe(true)

      resolveUpdate()
      await runPromise

      expect(service.running).toBe(false)
    })

    it('returns false after run() completes', async () => {
      const { fetcher, taskExecutionRepo, detailRepo } = createMocks()
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      await service.run()

      expect(service.running).toBe(false)
    })
  })

  describe('concurrent run() calls', () => {
    it('throws if run() is called while already running', async () => {
      const { taskExecutionRepo, detailRepo } = createMocks()
      let resolveUpdate!: () => void
      const fetcher = {
        updateUsdRate: vi.fn().mockImplementation(
          () => new Promise<ExchangeRate>((resolve) => {
            resolveUpdate = () => resolve(makeExchangeRate())
          }),
        ),
      }
      const service = new ExchangeRateCollectorService(fetcher as never, taskExecutionRepo as never, detailRepo as never, TASK_ID)

      const firstRun = service.run()
      await vi.waitFor(() => expect(fetcher.updateUsdRate).toHaveBeenCalled())

      await expect(service.run()).rejects.toThrow('Exchange rate collection is already running')

      resolveUpdate()
      await firstRun
    })
  })
})
