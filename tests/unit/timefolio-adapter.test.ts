// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { TimefolioAdapter, parseTimefolioXls } from '../../src/server/scheduler/timefolio-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 200, manager: 'timefolio',
    expense_ratio: '0.0050', download_url: 'https://timeetf.co.kr/m11_view.php?idx=10&cate=001',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

function makeXlsBuffer(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return buf
}

const HEADER = ['종목코드', '종목명', '수량', '평가금액(원)', '비중(%)']

const SAMPLE_ROWS = [
  HEADER,
  ['005930', '삼성전자', 2000, 150000000, 30.5],
  ['000660', 'SK하이닉스', 800, 50000000, 15.2],
]

describe('parseTimefolioXls', () => {
  it('should parse constituent rows from Excel', () => {
    const buf = makeXlsBuffer(SAMPLE_ROWS)
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
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
    const buf = makeXlsBuffer([
      HEADER,
      ['005930', '삼성전자', 2000, 150000000, 30.5],
      ['', '합계', 2000, 150000000, 100],
    ])
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should convert empty code with 현금 name to CASH', () => {
    const buf = makeXlsBuffer([
      HEADER,
      ['005930', '삼성전자', 2000, 150000000, 95],
      ['', '현금 및 기타', 0, 5000000, 5],
    ])
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[1].component_symbol).toBe('CASH')
    expect(result[1].component_name).toBe('현금 및 기타')
  })

  it('should return empty array for header-only Excel', () => {
    const buf = makeXlsBuffer([HEADER])
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should parse comma-separated numbers as numeric', () => {
    const buf = makeXlsBuffer(SAMPLE_ROWS)
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result[0].shares).toBe(2000)
  })

  it('should clean EQUITY suffix from foreign codes', () => {
    const buf = makeXlsBuffer([
      HEADER,
      ['AAPL US EQUITY', 'Apple Inc', 100, 20000000, 10],
    ])
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('AAPL')
  })

  it('should skip rows with zero weight and zero qty', () => {
    const buf = makeXlsBuffer([
      HEADER,
      ['005930', '삼성전자', 0, 0, 0],
    ])
    const result = parseTimefolioXls(buf, 200, '2026-03-13')
    expect(result).toEqual([])
  })
})

describe('TimefolioAdapter', () => {
  it('should convert URL to pdf_excel.php and append pdfDate + mode=pdf', async () => {
    const buf = makeXlsBuffer(SAMPLE_ROWS)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buf),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://timeetf.co.kr/pdf_excel.php?idx=10&cate=001&pdfDate=2026-03-13&mode=pdf',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('should replace existing pdfDate in URL', async () => {
    const buf = makeXlsBuffer(SAMPLE_ROWS)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buf),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    await adapter.fetchComponents(
      makeProfile({ download_url: 'https://timeetf.co.kr/m11_view.php?idx=10&pdfDate=2026-01-01&mode=pdf' }),
      '2026-03-13',
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://timeetf.co.kr/pdf_excel.php?idx=10&pdfDate=2026-03-13&mode=pdf',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('should fall back to T-1 date when today returns empty', async () => {
    const emptyBuf = makeXlsBuffer([HEADER])
    const dataBuf = makeXlsBuffer(SAMPLE_ROWS)
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(emptyBuf) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(dataBuf) })

    const adapter = new TimefolioAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-14')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(1,
      expect.stringContaining('pdfDate=2026-03-14'),
      expect.any(Object),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      expect.stringContaining('pdfDate=2026-03-13'),
      expect.any(Object),
    )
    expect(result).toHaveLength(2)
    expect(result[0].snapshot_date).toBe('2026-03-13')
  })

  it('should return empty when both today and T-1 have no data', async () => {
    const emptyBuf = makeXlsBuffer([HEADER])
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(emptyBuf),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-14')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' })
    const adapter = new TimefolioAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 500')
  })
})
