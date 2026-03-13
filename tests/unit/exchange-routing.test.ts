// PRD-FEAT-005: Price History Scheduler
import { describe, it, expect } from 'vitest'
import { resolveAdapter } from '../../src/server/scheduler/exchange-routing.js'
import type { AdapterType } from '../../src/server/scheduler/exchange-routing.js'

describe('resolveAdapter', () => {
  it('returns unknown for null', () => {
    expect(resolveAdapter(null)).toBe('unknown')
  })

  it.each([
    ['KRX', 'naver'],
    ['KOSPI', 'naver'],
    ['KOSDAQ', 'naver'],
  ] as const)('returns naver for domestic exchange %s', (exchange, expected) => {
    expect(resolveAdapter(exchange)).toBe(expected)
  })

  it.each([
    ['NASDAQ', 'yahoo'],
    ['NYSE', 'yahoo'],
    ['AMEX', 'yahoo'],
    ['TSX', 'yahoo'],
  ] as const)('returns yahoo for foreign exchange %s', (exchange, expected) => {
    expect(resolveAdapter(exchange)).toBe(expected)
  })

  it('returns unknown for unrecognized exchange', () => {
    expect(resolveAdapter('UPBIT')).toBe('unknown')
  })

  it('returns unknown for empty string', () => {
    expect(resolveAdapter('')).toBe('unknown')
  })
})
