// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EtfComponentCollectorService } from '../../src/server/scheduler/etf-component-collector-service.js'
import type { EtfProfile, EtfManager, TaskExecution } from '../../src/shared/types.js'
import type { EtfComponentRow } from '../../src/server/scheduler/etf-component-adapter.js'

vi.mock('../../src/server/scheduler/with-retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

vi.mock('../../src/server/middleware/logger.js', () => ({
  log: vi.fn(),
}))

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 100, manager: 'samsung-active',
    expense_ratio: '0.0015', download_url: 'https://example.com/test.xls',
    download_type: 'xls', created_at: '', updated_at: '',
    ...overrides,
  }
}

function makeExecution(overrides: Partial<TaskExecution> = {}): TaskExecution {
  return {
    id: 1, task_id: 1, started_at: '2026-03-13T00:00:00Z',
    finished_at: null, status: 'running', products_total: 0,
    products_succeeded: 0, products_failed: 0, products_skipped: 0,
    message: null, created_at: '2026-03-13T00:00:00Z',
    ...overrides,
  }
}

function createMocks() {
  const profileRepo = {
    findAll: vi.fn<() => Promise<readonly EtfProfile[]>>().mockResolvedValue([]),
  }
  const componentRepo = {
    hasSnapshot: vi.fn<(pid: number, date: string) => Promise<boolean>>().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
  }
  const taskExecutionRepo = {
    create: vi.fn().mockResolvedValue(makeExecution()),
    complete: vi.fn().mockImplementation(
      (_id: number, result: { status: string }) =>
        Promise.resolve(makeExecution({ status: result.status as TaskExecution['status'] })),
    ),
    trimOldExecutions: vi.fn().mockResolvedValue(0),
    updateProgress: vi.fn().mockResolvedValue(undefined),
  }
  const samsungAdapter = {
    fetchComponents: vi.fn<(p: EtfProfile, d: string) => Promise<readonly EtfComponentRow[]>>().mockResolvedValue([
      { etf_product_id: 100, component_symbol: '005930', component_name: '삼성전자', weight: '25.5000', shares: 1000, snapshot_date: '2026-03-13' },
    ]),
  }
  const timefolioAdapter = {
    fetchComponents: vi.fn().mockResolvedValue([]),
  }
  const riseAdapter = {
    fetchComponents: vi.fn().mockResolvedValue([]),
  }

  const adapters = new Map<EtfManager, typeof samsungAdapter>([
    ['samsung-active', samsungAdapter],
    ['timefolio', timefolioAdapter],
    ['rise', riseAdapter],
  ])

  return { profileRepo, componentRepo, taskExecutionRepo, adapters, samsungAdapter, timefolioAdapter, riseAdapter }
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new EtfComponentCollectorService(
    mocks.profileRepo as never,
    mocks.componentRepo as never,
    mocks.taskExecutionRepo as never,
    mocks.adapters as never,
    1,
  )
}

describe('EtfComponentCollectorService', () => {
  let mocks: ReturnType<typeof createMocks>
  let service: EtfComponentCollectorService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'))
    mocks = createMocks()
    service = createService(mocks)
  })

  describe('run', () => {
    it('should throw if already running', async () => {
      mocks.profileRepo.findAll.mockImplementation(
        () => new Promise(() => {}), // never resolves
      )
      const first = service.run()
      await expect(service.run()).rejects.toThrow('already running')
      service.abort()
      await first.catch(() => {})
    })

    it('should complete with success when all ETFs succeed', async () => {
      mocks.profileRepo.findAll.mockResolvedValue([makeProfile()])

      const result = await service.run()

      expect(result.status).toBe('success')
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalledOnce()
      expect(mocks.componentRepo.upsertMany).toHaveBeenCalledOnce()
    })

    it('should skip ETF when snapshot already exists', async () => {
      mocks.profileRepo.findAll.mockResolvedValue([makeProfile()])
      mocks.componentRepo.hasSnapshot.mockResolvedValue(true)

      await service.run()

      expect(mocks.samsungAdapter.fetchComponents).not.toHaveBeenCalled()
    })

    it('should isolate per-ETF errors and continue', async () => {
      const profiles = [
        makeProfile({ id: 1, product_id: 100 }),
        makeProfile({ id: 2, product_id: 200, manager: 'timefolio' }),
      ]
      mocks.profileRepo.findAll.mockResolvedValue(profiles)
      mocks.samsungAdapter.fetchComponents.mockRejectedValue(new Error('Network error'))
      mocks.timefolioAdapter.fetchComponents.mockResolvedValue([])

      const result = await service.run()

      // Both ETFs were attempted
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalled()
      expect(mocks.timefolioAdapter.fetchComponents).toHaveBeenCalled()
      expect(result.status).toBe('partial')
    })

    it('should skip ETF with unknown manager', async () => {
      const profiles = [
        makeProfile({ manager: 'unknown-manager' as EtfManager }),
      ]
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      await service.run()

      expect(mocks.samsungAdapter.fetchComponents).not.toHaveBeenCalled()
    })

    it('should process in chunks of 5 with delay between chunks', async () => {
      const profiles = Array.from({ length: 7 }, (_, i) =>
        makeProfile({ id: i + 1, product_id: 100 + i }),
      )
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      const runPromise = service.run()

      // Advance timers to process delays
      await vi.advanceTimersByTimeAsync(1000)

      await runPromise

      // All 7 ETFs were processed
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalledTimes(7)
    })
  })

  describe('abort', () => {
    it('should stop processing after current chunk', async () => {
      const profiles = Array.from({ length: 10 }, (_, i) =>
        makeProfile({ id: i + 1, product_id: 100 + i }),
      )
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      // Abort after first chunk starts
      let callCount = 0
      mocks.samsungAdapter.fetchComponents.mockImplementation(async () => {
        callCount++
        if (callCount === 3) service.abort()
        return [{ etf_product_id: 100, component_symbol: '005930', component_name: 'Test', weight: '10.0000', shares: 100, snapshot_date: '2026-03-13' }]
      })

      const runPromise = service.run()
      await vi.advanceTimersByTimeAsync(5000)
      const result = await runPromise

      expect(result.status).toBe('aborted')
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalled()
      // Should not have processed all 10
      expect(callCount).toBeLessThan(10)
    })
  })
})
