import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('log', () => {
  let originalWrite: typeof process.stdout.write
  let output: string

  beforeEach(() => {
    output = ''
    originalWrite = process.stdout.write
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      output += chunk.toString()
      return true
    }) as typeof process.stdout.write
  })

  afterEach(() => {
    process.stdout.write = originalWrite
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('logs info messages when LOG_LEVEL=info', async () => {
    vi.stubEnv('LOG_LEVEL', 'info')
    const { log } = await import('../../src/server/middleware/logger.js')
    log('info', 'test message')
    expect(output).toContain('[INFO]')
    expect(output).toContain('test message')
  })

  it('suppresses debug messages when LOG_LEVEL=info', async () => {
    vi.stubEnv('LOG_LEVEL', 'info')
    const { log } = await import('../../src/server/middleware/logger.js')
    log('debug', 'hidden')
    expect(output).toBe('')
  })

  it('shows debug messages when LOG_LEVEL=debug', async () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    const { log } = await import('../../src/server/middleware/logger.js')
    log('debug', 'visible')
    expect(output).toContain('[DEBUG]')
  })
})
