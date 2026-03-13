// PRD-FEAT-005: Price History Scheduler
import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../../src/server/scheduler/with-retry.js'

describe('withRetry', () => {
  it('succeeds on first try without retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await withRetry(fn, 2, 10)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries once and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, 2, 10)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries twice and succeeds on third attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, 2, 10)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws last error after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent-error'))

    await expect(withRetry(fn, 2, 10)).rejects.toThrow('persistent-error')
  })

  it('calls fn exactly maxRetries+1 times on full failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(withRetry(fn, 3, 10)).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('applies exponential backoff delays', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const baseDelayMs = 50

    const start = Date.now()
    await expect(withRetry(fn, 2, baseDelayMs)).rejects.toThrow('fail')
    const elapsed = Date.now() - start

    // Attempt 0: immediate (0ms)
    // Attempt 1: 50ms delay (50 * 2^0)
    // Attempt 2: 100ms delay (50 * 2^1)
    // Total delay: ~150ms
    expect(elapsed).toBeGreaterThanOrEqual(120) // allow some tolerance
    expect(elapsed).toBeLessThan(500)
  })
})
