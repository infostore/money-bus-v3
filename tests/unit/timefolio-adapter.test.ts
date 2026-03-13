// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { TimefolioAdapter, parseTimefolioHtml } from '../../src/server/scheduler/timefolio-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 200, manager: 'timefolio',
    expense_ratio: '0.0050', download_url: 'https://example.com/etf',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

const SAMPLE_HTML = `
<html><body>
<table class="holdings">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>수량</th></tr></thead>
  <tbody>
    <tr><td>005930</td><td>삼성전자</td><td>30.50</td><td>2000</td></tr>
    <tr><td>000660</td><td>SK하이닉스</td><td>15.20</td><td>800</td></tr>
  </tbody>
</table>
</body></html>
`

const EMPTY_HTML = `
<html><body>
<table class="holdings">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>수량</th></tr></thead>
  <tbody></tbody>
</table>
</body></html>
`

describe('parseTimefolioHtml', () => {
  it('should parse constituent rows from HTML table', () => {
    const result = parseTimefolioHtml(SAMPLE_HTML, 200, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 200,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '30.5000',
      shares: 2000,
      snapshot_date: '2026-03-13',
    })
  })

  it('should return empty array for empty table body', () => {
    const result = parseTimefolioHtml(EMPTY_HTML, 200, '2026-03-13')
    expect(result).toEqual([])
  })
})

describe('TimefolioAdapter', () => {
  it('should fetch HTML and parse components', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/etf')
    expect(result).toHaveLength(2)
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' })
    const adapter = new TimefolioAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 500')
  })
})
