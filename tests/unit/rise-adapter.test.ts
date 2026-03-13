// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { RiseAdapter, parseRiseHtml } from '../../src/server/scheduler/rise-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 300, manager: 'rise',
    expense_ratio: '0.0030',
    download_url: 'https://www.riseetf.co.kr/prod/finder/productViewTabExcel3?searchTargetId=44K0&searchDate=',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

// Real RISE HTML structure: tr.top with 7+ cells
// cells[0]=순번, cells[1]=종류, cells[2]=ISIN, cells[3]=종목명, cells[4]=수량, cells[5]=비중, cells[6]=평가금액
const SAMPLE_HTML = `
<html><body>
<table>
  <tr class="top"><td>1</td><td>주식</td><td>KR7005930003</td><td>삼성전자</td><td>1,500</td><td>20.10</td><td>100,000,000</td></tr>
  <tr class="top"><td>2</td><td>주식</td><td>KR7035420009</td><td>NAVER</td><td>300</td><td>10.50</td><td>50,000,000</td></tr>
</table>
</body></html>
`

const HTML_WITH_SUMMARY = `
<html><body>
<table>
  <tr class="top"><td>1</td><td>주식</td><td>KR7005930003</td><td>삼성전자</td><td>1,500</td><td>20.10</td><td>100,000,000</td></tr>
  <tr class="top"><td></td><td></td><td></td><td>합계</td><td>1,500</td><td>100.00</td><td>100,000,000</td></tr>
</table>
</body></html>
`

const EMPTY_HTML = `<html><body><table></table></body></html>`

describe('parseRiseHtml', () => {
  it('should parse RISE table rows and convert ISIN to 6-digit code', () => {
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
    expect(result[1].component_symbol).toBe('035420')
  })

  it('should skip 합계 rows', () => {
    const result = parseRiseHtml(HTML_WITH_SUMMARY, 300, '2026-03-13')
    expect(result).toHaveLength(1)
  })

  it('should skip nan names', () => {
    const html = `
      <table>
        <tr class="top"><td>1</td><td>주식</td><td>KR7005930003</td><td>nan</td><td>0</td><td>0</td><td>0</td></tr>
      </table>
    `
    const result = parseRiseHtml(html, 300, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should return empty array for empty table', () => {
    const result = parseRiseHtml(EMPTY_HTML, 300, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should parse comma-separated numbers', () => {
    const result = parseRiseHtml(SAMPLE_HTML, 300, '2026-03-13')
    expect(result[0].shares).toBe(1500)
  })

  it('should pass through non-ISIN codes unchanged', () => {
    const html = `
      <table>
        <tr class="top"><td>1</td><td>주식</td><td>AAPL</td><td>Apple</td><td>100</td><td>5.00</td><td>10,000</td></tr>
      </table>
    `
    const result = parseRiseHtml(html, 300, '2026-03-13')
    expect(result[0].component_symbol).toBe('AAPL')
  })
})

describe('RiseAdapter', () => {
  it('should append searchDate to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new RiseAdapter(mockFetch)
    await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.riseetf.co.kr/prod/finder/productViewTabExcel3?searchTargetId=44K0&searchDate=2026-03-13',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
    const adapter = new RiseAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 403')
  })
})
