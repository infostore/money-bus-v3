// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { RiseAdapter, parseRiseHtml } from '../../src/server/scheduler/rise-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 300, manager: 'rise',
    expense_ratio: '0.0030', download_url: 'https://example.com/rise-etf',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

const SAMPLE_HTML = `
<html><body>
<table class="component-table">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>보유수량</th></tr></thead>
  <tbody>
    <tr><td>005930</td><td>삼성전자</td><td>20.10</td><td>1500</td></tr>
    <tr><td>035420</td><td>NAVER</td><td>10.50</td><td>300</td></tr>
  </tbody>
</table>
</body></html>
`

const EMPTY_HTML = `
<html><body>
<table class="component-table">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>보유수량</th></tr></thead>
  <tbody></tbody>
</table>
</body></html>
`

describe('parseRiseHtml', () => {
  it('should parse RISE table rows', () => {
    const result = parseRiseHtml(SAMPLE_HTML, 300, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 300,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '20.1000',
      shares: 1500,
      snapshot_date: '2026-03-13',
    })
  })

  it('should return empty array for empty table', () => {
    const result = parseRiseHtml(EMPTY_HTML, 300, '2026-03-13')
    expect(result).toEqual([])
  })
})

describe('RiseAdapter', () => {
  it('should fetch and parse RISE HTML', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new RiseAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(result).toHaveLength(2)
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
    const adapter = new RiseAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 403')
  })
})
