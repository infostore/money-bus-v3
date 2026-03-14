// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExchangeRateFetcher, FALLBACK_USD_KRW } from '../../src/server/services/exchange-rate-fetcher.js'
import type { ExchangeRate } from '../../src/shared/types.js'

vi.mock('../../src/server/middleware/logger.js', () => ({ log: vi.fn() }))

const SAMPLE_NAVER_HTML = `
<html><body>
<p class="no_today"><span class="blind">현재가</span><span class="no1">1</span><span class="no2">4</span><span class="no3">3</span><span class="no4">2</span><span class="jum">.</span><span class="no5">5</span><span class="no6">0</span></p>
</body></html>
`

const SAMPLE_EXIM_RESPONSE = [
  { cur_unit: 'EUR', deal_bas_r: '1,450.23' },
  { cur_unit: 'USD', deal_bas_r: '1,380.50' },
]

function makeExchangeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 1,
    currency: 'USD',
    rate: '1350.0000',
    updated_at: '2026-03-14T00:00:00.000Z',
    ...overrides,
  }
}

function createMocks() {
  const mockFetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()
  const repo = {
    upsert: vi.fn<(currency: string, rate: number) => Promise<ExchangeRate>>()
      .mockResolvedValue(makeExchangeRate()),
  }
  return { mockFetch, repo }
}

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeHtmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html' },
  })
}

describe('ExchangeRateFetcher', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env['EXIM_API_KEY']
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('fetchUsdRate', () => {
    it('returns parsed rate from EXIM when API key is set and call succeeds', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeJsonResponse(SAMPLE_EXIM_RESPONSE))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1380.5)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toContain('koreaexim.go.kr')
    })

    it('falls through to Naver when EXIM fails', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      // EXIM fails
      mockFetch.mockRejectedValueOnce(new Error('network error'))
      // Naver succeeds
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('returns Naver rate when EXIM_API_KEY is not set', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0][0]).toContain('naver.com')
    })

    it('returns FALLBACK_USD_KRW when both EXIM and Naver fail', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      mockFetch.mockRejectedValueOnce(new Error('EXIM down'))
      mockFetch.mockRejectedValueOnce(new Error('Naver down'))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(FALLBACK_USD_KRW)
      expect(rate).toBe(1350)
    })

    it('falls through to Naver when EXIM returns HTTP error status', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeJsonResponse(null, 503))
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
    })

    it('falls through to Naver when EXIM deal_bas_r is non-numeric', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      const badResponse = [{ cur_unit: 'USD', deal_bas_r: 'N/A' }]
      mockFetch.mockResolvedValueOnce(makeJsonResponse(badResponse))
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
    })

    it('falls through to Naver when USD not found in EXIM response', async () => {
      process.env['EXIM_API_KEY'] = 'test-key'
      const { mockFetch, repo } = createMocks()
      const noUsd = [{ cur_unit: 'EUR', deal_bas_r: '1,450.23' }]
      mockFetch.mockResolvedValueOnce(makeJsonResponse(noUsd))
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
    })

    it('returns FALLBACK when Naver HTML has no no_today element', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse('<html><body>no data</body></html>'))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(FALLBACK_USD_KRW)
    })

    it('returns FALLBACK when Naver returns HTTP error status', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse('', 500))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(FALLBACK_USD_KRW)
    })
  })

  describe('Naver HTML parsing', () => {
    it('correctly parses 4 integer digits + 2 decimal digits to 1432.50', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1432.5)
    })

    it('parses integer-only rate (no jum element)', async () => {
      const html = `
        <p class="no_today">
          <span class="blind">현재가</span>
          <span class="no1">1</span>
          <span class="no2">3</span>
          <span class="no3">5</span>
          <span class="no4">0</span>
        </p>
      `
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(html))

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const rate = await fetcher.fetchUsdRate()

      expect(rate).toBe(1350)
    })
  })

  describe('updateUsdRate', () => {
    it('calls fetchUsdRate and upserts result, returning ExchangeRate', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockResolvedValueOnce(makeHtmlResponse(SAMPLE_NAVER_HTML))
      const expected = makeExchangeRate({ rate: '1432.5' })
      repo.upsert.mockResolvedValueOnce(expected)

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const result = await fetcher.updateUsdRate()

      expect(repo.upsert).toHaveBeenCalledWith('USD', 1432.5)
      expect(result).toBe(expected)
    })

    it('upserts with fallback rate when all sources fail', async () => {
      const { mockFetch, repo } = createMocks()
      mockFetch.mockRejectedValueOnce(new Error('Naver down'))
      const expected = makeExchangeRate({ rate: '1350' })
      repo.upsert.mockResolvedValueOnce(expected)

      const fetcher = new ExchangeRateFetcher(repo as never, mockFetch)
      const result = await fetcher.updateUsdRate()

      expect(repo.upsert).toHaveBeenCalledWith('USD', FALLBACK_USD_KRW)
      expect(result).toBe(expected)
    })
  })
})
