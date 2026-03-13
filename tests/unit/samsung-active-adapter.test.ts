// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { SamsungActiveAdapter, parseXlsBuffer } from '../../src/server/scheduler/samsung-active-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'
import * as XLSX from 'xlsx'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1,
    product_id: 100,
    manager: 'samsung-active',
    expense_ratio: '0.0015',
    download_url: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFQ1&gijunYMD=',
    download_type: 'xls',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Create XLS buffer matching Samsung Active's real format:
 * Row 0: header
 * Row 1: date string
 * Row 2: column headers
 * Row 3+: data — cells: [종류, 종목명, 통화, 종목코드, 수량, 비중]
 */
function createXlsBuffer(
  dataRows: Array<{ name: string; code: string; qty: number; weight: number }>,
): ArrayBuffer {
  const rows: (string | number)[][] = [
    ['종류', '종목명', '통화', '종목코드', '보유수량', '비중(%)'],
    ['2026/03/13'],
    ['', '', '', '', '', ''],
  ]
  for (const row of dataRows) {
    rows.push(['주식', row.name, 'KRW', row.code, row.qty, row.weight])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const xlsBuffer = XLSX.write(wb, { type: 'array', bookType: 'xls' })
  return xlsBuffer
}

describe('parseXlsBuffer', () => {
  it('should parse rows using row-index based mapping', () => {
    const buffer = createXlsBuffer([
      { name: '삼성전자', code: '005930', qty: 1000, weight: 25.5 },
      { name: 'SK하이닉스', code: '000660', qty: 500, weight: 15.3 },
    ])

    const result = parseXlsBuffer(buffer, 100, '2026-03-13')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 100,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '25.5000',
      shares: 1000,
      snapshot_date: '2026-03-13',
    })
    expect(result[1].component_symbol).toBe('000660')
  })

  it('should skip rows with 합계 or 예금 in name', () => {
    const buffer = createXlsBuffer([
      { name: '삼성전자', code: '005930', qty: 1000, weight: 25.5 },
      { name: '합계', code: '', qty: 0, weight: 100 },
      { name: '예금', code: '', qty: 0, weight: 5 },
    ])

    const result = parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toHaveLength(1)
  })

  it('should clean equity suffix from code', () => {
    const buffer = createXlsBuffer([
      { name: '삼성전자', code: '005930 KS EQUITY', qty: 1000, weight: 25.5 },
    ])

    const result = parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should return empty array for sheet with less than 4 rows', () => {
    const ws = XLSX.utils.aoa_to_sheet([['header']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xls' })

    const result = parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should handle percentage values stored as decimals', () => {
    const rows: (string | number)[][] = [
      ['종류', '종목명', '통화', '종목코드', '보유수량', '비중(%)'],
      ['2026/03/13'],
      ['', '', '', '', '', ''],
      ['주식', '삼성전자', 'KRW', '005930', 1000, 0.255],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xls' })

    const result = parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toHaveLength(1)
    // 0.255 → 25.5 → "25.5000"
    expect(result[0].weight).toBe('25.5000')
  })
})

describe('SamsungActiveAdapter', () => {
  it('should append date to URL and fetch XLS', async () => {
    const xlsBuffer = createXlsBuffer([
      { name: '삼성전자', code: '005930', qty: 1000, weight: 25.5 },
    ])
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(xlsBuffer),
    })

    const adapter = new SamsungActiveAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFQ1&gijunYMD=20260313',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    const adapter = new SamsungActiveAdapter(mockFetch)

    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 404')
  })

  it('should return empty for zero-length response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    const adapter = new SamsungActiveAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(result).toEqual([])
  })
})
