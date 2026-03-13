// PRD-FEAT-005: Price History Scheduler
import { describe, it, expect, vi } from 'vitest'
import {
  YahooFinanceAdapter,
  type YahooFinanceClient,
  type YahooHistoricalRow,
} from '../../src/server/scheduler/yahoo-finance-adapter.js'

function createMockClient(
  result: readonly YahooHistoricalRow[] = [],
): YahooFinanceClient {
  return {
    historical: vi.fn().mockResolvedValue(result),
  }
}

function makeRow(overrides: Partial<YahooHistoricalRow> = {}): YahooHistoricalRow {
  return {
    date: new Date('2024-06-15'),
    open: 150.5,
    high: 155.0,
    low: 149.0,
    close: 153.25,
    volume: 1_000_000,
    ...overrides,
  }
}

describe('YahooFinanceAdapter', () => {
  const startDate = new Date('2024-06-01')
  const endDate = new Date('2024-06-30')

  it('calls client.historical with correct params', async () => {
    const client = createMockClient()
    const adapter = new YahooFinanceAdapter(client)

    await adapter.fetchPrices('AAPL', 42, startDate, endDate)

    expect(client.historical).toHaveBeenCalledWith('AAPL', {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })
  })

  it('maps YahooHistoricalRow to PriceRow correctly', async () => {
    const row = makeRow()
    const client = createMockClient([row])
    const adapter = new YahooFinanceAdapter(client)

    const result = await adapter.fetchPrices('AAPL', 42, startDate, endDate)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      productId: 42,
      date: '2024-06-15',
      open: '150.5',
      high: '155',
      low: '149',
      close: '153.25',
      volume: 1_000_000,
    })
  })

  it('converts date to YYYY-MM-DD string', async () => {
    const row = makeRow({ date: new Date('2025-01-03T14:30:00Z') })
    const client = createMockClient([row])
    const adapter = new YahooFinanceAdapter(client)

    const result = await adapter.fetchPrices('AAPL', 1, startDate, endDate)

    expect(result[0]?.date).toBe('2025-01-03')
  })

  it('converts numeric OHLCV to string', async () => {
    const row = makeRow({
      open: 100.123,
      high: 200.456,
      low: 50.789,
      close: 175.0,
    })
    const client = createMockClient([row])
    const adapter = new YahooFinanceAdapter(client)

    const result = await adapter.fetchPrices('AAPL', 1, startDate, endDate)

    expect(result[0]?.open).toBe('100.123')
    expect(result[0]?.high).toBe('200.456')
    expect(result[0]?.low).toBe('50.789')
    expect(result[0]?.close).toBe('175')
  })

  it('returns empty array when client returns empty', async () => {
    const client = createMockClient([])
    const adapter = new YahooFinanceAdapter(client)

    const result = await adapter.fetchPrices('AAPL', 1, startDate, endDate)

    expect(result).toEqual([])
  })

  it('propagates client errors', async () => {
    const client: YahooFinanceClient = {
      historical: vi.fn().mockRejectedValue(new Error('network timeout')),
    }
    const adapter = new YahooFinanceAdapter(client)

    await expect(
      adapter.fetchPrices('AAPL', 1, startDate, endDate),
    ).rejects.toThrow('network timeout')
  })

  it('maps multiple rows preserving order', async () => {
    const rows: readonly YahooHistoricalRow[] = [
      makeRow({ date: new Date('2024-06-10'), close: 100 }),
      makeRow({ date: new Date('2024-06-11'), close: 105 }),
      makeRow({ date: new Date('2024-06-12'), close: 110 }),
    ]
    const client = createMockClient(rows)
    const adapter = new YahooFinanceAdapter(client)

    const result = await adapter.fetchPrices('TSLA', 7, startDate, endDate)

    expect(result).toHaveLength(3)
    expect(result[0]?.date).toBe('2024-06-10')
    expect(result[1]?.date).toBe('2024-06-11')
    expect(result[2]?.date).toBe('2024-06-12')
    expect(result.every((r) => r.productId === 7)).toBe(true)
  })

  // PRD-FEAT-009 v1.1: Abort signal support
  it('throws when abort signal is already aborted', async () => {
    const client = createMockClient([makeRow()])
    const adapter = new YahooFinanceAdapter(client)
    const controller = new AbortController()
    controller.abort()

    await expect(
      adapter.fetchPrices('AAPL', 1, startDate, endDate, controller.signal),
    ).rejects.toThrow()
  })

  it('throws when abort signal fires during fetch', async () => {
    const controller = new AbortController()
    const client: YahooFinanceClient = {
      historical: vi.fn().mockImplementation(async () => {
        controller.abort()
        // Simulate slow response — abort should be checked after
        return [makeRow()]
      }),
    }
    const adapter = new YahooFinanceAdapter(client)

    // Even though historical returns data, the signal was aborted during the call
    // The adapter should check signal after await and throw
    await expect(
      adapter.fetchPrices('AAPL', 1, startDate, endDate, controller.signal),
    ).rejects.toThrow()
  })
})
