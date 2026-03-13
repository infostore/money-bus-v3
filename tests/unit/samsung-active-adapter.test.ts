// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { SamsungActiveAdapter, parseXlsBuffer } from '../../src/server/scheduler/samsung-active-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'
import ExcelJS from 'exceljs'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1,
    product_id: 100,
    manager: 'samsung-active',
    expense_ratio: '0.0015',
    download_url: 'https://example.com/holdings.xls',
    download_type: 'xls',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function createXlsBuffer(rows: Array<[string, string, number, number]>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRow(['종목코드', '종목명', '비중(%)', '보유수량'])
  for (const row of rows) {
    sheet.addRow(row)
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe('parseXlsBuffer', () => {
  it('should parse rows with correct column mapping', async () => {
    const buffer = await createXlsBuffer([
      ['005930', '삼성전자', 25.5, 1000],
      ['000660', 'SK하이닉스', 15.3, 500],
    ])

    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')

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

  it('should return empty array for empty sheet', async () => {
    const buffer = await createXlsBuffer([])
    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should handle null weight and shares gracefully', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sheet1')
    sheet.addRow(['종목코드', '종목명', '비중(%)', '보유수량'])
    sheet.addRow(['005930', '삼성전자', null, null])
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBeNull()
    expect(result[0].shares).toBeNull()
  })
})

describe('SamsungActiveAdapter', () => {
  it('should fetch and parse XLS from download_url', async () => {
    const xlsBuffer = await createXlsBuffer([
      ['005930', '삼성전자', 25.5, 1000],
    ])
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(xlsBuffer.buffer.slice(xlsBuffer.byteOffset, xlsBuffer.byteOffset + xlsBuffer.byteLength)),
    })

    const adapter = new SamsungActiveAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/holdings.xls')
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    const adapter = new SamsungActiveAdapter(mockFetch)

    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 404')
  })
})
