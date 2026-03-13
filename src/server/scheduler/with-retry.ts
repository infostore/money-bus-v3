// PRD-FEAT-005: Price History Scheduler

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retries (default 2)
 * @param baseDelayMs - Base delay in ms for backoff calculation (default 1000)
 * @returns The result of fn()
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      await sleep(delay)
    }

    try {
      return await fn()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}
