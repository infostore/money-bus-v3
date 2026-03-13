// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { TimefolioAdapter, parseTimefolioHtml } from '../../src/server/scheduler/timefolio-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 200, manager: 'timefolio',
    expense_ratio: '0.0050', download_url: 'https://timeetf.co.kr/m11_view.php?idx=10&cate=001',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

// Real TIMEFOLIO HTML structure: table.table3.moreList1
// cells[0]=code, cells[1]=name, cells[2]=qty, cells[3]=평가금액, cells[4]=weight
const SAMPLE_HTML = `
<html><body>
<table class="table3 moreList1">
  <tr><td>005930</td><td>삼성전자</td><td>2,000</td><td>150,000,000</td><td>30.50</td></tr>
  <tr><td>000660</td><td>SK하이닉스</td><td>800</td><td>50,000,000</td><td>15.20</td></tr>
</table>
</body></html>
`

const HTML_WITH_SUMMARY = `
<html><body>
<table class="table3 moreList1">
  <tr><td>005930</td><td>삼성전자</td><td>2,000</td><td>150,000,000</td><td>30.50</td></tr>
  <tr><td></td><td>합계</td><td>2,000</td><td>150,000,000</td><td>100.00</td></tr>
</table>
</body></html>
`

const HTML_WITH_CASH = `
<html><body>
<table class="table3 moreList1">
  <tr><td>005930</td><td>삼성전자</td><td>2,000</td><td>150,000,000</td><td>95.00</td></tr>
  <tr><td></td><td>현금 및 기타</td><td>0</td><td>5,000,000</td><td>5.00</td></tr>
</table>
</body></html>
`

const EMPTY_HTML = `<html><body><table class="table3 moreList1"></table></body></html>`

describe('parseTimefolioHtml', () => {
  it('should parse constituent rows from table.table3.moreList1', () => {
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

  it('should skip 합계 rows', () => {
    const result = parseTimefolioHtml(HTML_WITH_SUMMARY, 200, '2026-03-13')
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should convert empty code with 현금 name to CASH', () => {
    const result = parseTimefolioHtml(HTML_WITH_CASH, 200, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[1].component_symbol).toBe('CASH')
    expect(result[1].component_name).toBe('현금 및 기타')
  })

  it('should return empty array for empty table', () => {
    const result = parseTimefolioHtml(EMPTY_HTML, 200, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should parse comma-separated numbers', () => {
    const result = parseTimefolioHtml(SAMPLE_HTML, 200, '2026-03-13')
    expect(result[0].shares).toBe(2000)
  })
})

describe('TimefolioAdapter', () => {
  it('should append pdfDate and mode=pdf to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://timeetf.co.kr/m11_view.php?idx=10&cate=001&pdfDate=2026-03-13&mode=pdf',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('should replace existing pdfDate in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    await adapter.fetchComponents(
      makeProfile({ download_url: 'https://timeetf.co.kr/m11_view.php?idx=10&pdfDate=2026-01-01&mode=pdf' }),
      '2026-03-13',
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://timeetf.co.kr/m11_view.php?idx=10&pdfDate=2026-03-13&mode=pdf',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' })
    const adapter = new TimefolioAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 500')
  })
})
