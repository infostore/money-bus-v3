// PRD-FEAT-005: Price History Scheduler
// PRD-FEAT-009: Scheduler Execution Stop (v1.1 — abort signal support)

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export interface RetryOptions {
  readonly maxRetries?: number
  readonly baseDelayMs?: number
  readonly signal?: AbortSignal
}

/**
 * Retry an async function with exponential backoff.
 * Supports both positional args (backward-compatible) and options object.
 *
 * @param fn - Async function to execute
 * @param optionsOrMaxRetries - RetryOptions object or maxRetries number
 * @param baseDelayMs - Base delay in ms (only when using positional args)
 * @returns The result of fn()
 * @throws AbortError if signal is aborted
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  optionsOrMaxRetries?: RetryOptions | number,
  baseDelayMs?: number,
): Promise<T> {
  const opts = typeof optionsOrMaxRetries === 'object'
    ? optionsOrMaxRetries
    : { maxRetries: optionsOrMaxRetries, baseDelayMs }

  const maxRetries = opts.maxRetries ?? 2
  const delay = opts.baseDelayMs ?? 1000
  const signal = opts.signal

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    if (attempt > 0) {
      const backoff = delay * Math.pow(2, attempt - 1)
      await sleep(backoff)
    }

    try {
      return await fn()
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      lastError = error
    }
  }

  throw lastError
}
