// PRD-FEAT-005: Price History Scheduler
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseNaverResponse,
  NaverFinanceAdapter,
} from '../../src/server/scheduler/naver-finance-adapter.js'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../fixtures/naver-sise-response.json',
)
const FIXTURE_TEXT = fs.readFileSync(FIXTURE_PATH, 'utf-8')

describe('parseNaverResponse', () => {
  it('parses fixture data into correct number of PriceRows', () => {
    const rows = parseNaverResponse(FIXTURE_TEXT, 42)

    expect(rows).toHaveLength(3)
  })

  it('returns empty array for empty response', () => {
    expect(parseNaverResponse('', 1)).toEqual([])
    expect(parseNaverResponse('  ', 1)).toEqual([])
  })

  it('returns empty array for header-only response', () => {
    const headerOnly =
      '[["날짜", "시가", "고가", "저가", "종가", "거래량", "외국인소진율"]]'

    expect(parseNaverResponse(headerOnly, 1)).toEqual([])
  })

  it('converts YYYYMMDD to YYYY-MM-DD', () => {
    const rows = parseNaverResponse(FIXTURE_TEXT, 1)

    expect(rows[0]!.date).toBe('2026-03-12')
    expect(rows[1]!.date).toBe('2026-03-11')
    expect(rows[2]!.date).toBe('2026-03-10')
  })

  it('maps numeric values to strings for OHLCV', () => {
    const rows = parseNaverResponse(FIXTURE_TEXT, 1)
    const first = rows[0]!

    expect(first.open).toBe('78000')
    expect(first.high).toBe('78500')
    expect(first.low).toBe('77200')
    expect(first.close).toBe('77800')
    expect(first.volume).toBe(12345678)
  })

  it('sets productId on all rows', () => {
    const rows = parseNaverResponse(FIXTURE_TEXT, 99)

    for (const row of rows) {
      expect(row.productId).toBe(99)
    }
  })

  it('handles Naver single-quote format', () => {
    const singleQuoted = `[
      ['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율'],
      ['20260312', 78000, 78500, 77200, 77800, 12345678, 52.1],
    ]`

    const rows = parseNaverResponse(singleQuoted, 1)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.date).toBe('2026-03-12')
  })
})

describe('NaverFinanceAdapter', () => {
  it('calls fetch with correct URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(FIXTURE_TEXT, { status: 200 }),
    )
    const adapter = new NaverFinanceAdapter(mockFetch)

    await adapter.fetchPrices('005930', 1, '20260310', '20260312')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.finance.naver.com/siseJson.naver?symbol=005930&requestType=1&startTime=20260310&endTime=20260312&timeframe=day',
    )
  })

  it('returns parsed PriceRow array', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(FIXTURE_TEXT, { status: 200 }),
    )
    const adapter = new NaverFinanceAdapter(mockFetch)

    const rows = await adapter.fetchPrices('005930', 42, '20260310', '20260312')

    expect(rows).toHaveLength(3)
    expect(rows[0]!.productId).toBe(42)
    expect(rows[0]!.close).toBe('77800')
  })

  it('returns empty array when API returns empty body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', { status: 200 }),
    )
    const adapter = new NaverFinanceAdapter(mockFetch)

    const rows = await adapter.fetchPrices('005930', 1, '20260310', '20260312')

    expect(rows).toEqual([])
  })
})
