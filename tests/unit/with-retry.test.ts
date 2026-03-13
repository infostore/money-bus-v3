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

  // PRD-FEAT-009 v1.1: Abort signal support
  describe('abort signal support', () => {
    it('throws AbortError immediately when signal is already aborted', async () => {
      const fn = vi.fn().mockResolvedValue('ok')
      const controller = new AbortController()
      controller.abort()

      await expect(
        withRetry(fn, { signal: controller.signal }),
      ).rejects.toThrow('Aborted')
      expect(fn).not.toHaveBeenCalled()
    })

    it('stops retrying when signal fires between attempts', async () => {
      const controller = new AbortController()
      const fn = vi.fn().mockImplementation(async () => {
        controller.abort()
        throw new Error('fail')
      })

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelayMs: 10, signal: controller.signal }),
      ).rejects.toThrow('Aborted')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('works without signal (backward compatible with options object)', async () => {
      const fn = vi.fn().mockResolvedValue('ok')

      const result = await withRetry(fn, { maxRetries: 1, baseDelayMs: 10 })

      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
