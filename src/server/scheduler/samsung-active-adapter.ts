// PRD-FEAT-012: ETF Component Collection Scheduler
import ExcelJS from 'exceljs'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const REQUEST_TIMEOUT = 30_000

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Connection: 'keep-alive',
}

function formatDateCompact(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function cleanEquitySuffix(code: string): string {
  return code.replace(/\s+[A-Z]{2}\s+EQUITY$/i, '').trim()
}

function parseNumeric(value: unknown): number {
  if (value == null) return NaN
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim()
  const num = Number(cleaned)
  return num
}

/**
 * Parse Samsung XLS buffer using row-index based parsing (matches v1 format).
 * Row 2: date string (e.g. "2026/03/13")
 * Row 4+: data rows — cells[1]=name, cells[3]=code, cells[4]=qty, cells[5]=weight
 */
export async function parseXlsBuffer(
  buffer: Buffer,
  productId: number,
  snapshotDate: string,
): Promise<readonly EtfComponentRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 4) return []

  const results: EtfComponentRow[] = []

  for (let i = 4; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const cellCount = row.cellCount
    if (cellCount < 6) continue

    const name = String(row.getCell(2).value ?? '').trim()
    let code = String(row.getCell(4).value ?? '').trim()

    if (!name || name.includes('합계') || name.includes('예금')) continue

    code = cleanEquitySuffix(code)
    if (!code) continue

    const qty = parseNumeric(row.getCell(5).value)
    let weight = parseNumeric(row.getCell(6).value)

    // ExcelJS returns percentage-formatted cells as decimals (0.2341 for 23.41%)
    if (typeof row.getCell(6).value === 'number' && weight > 0 && weight < 1) {
      weight = Math.round(weight * 10000) / 100
    }

    if (isNaN(weight) && isNaN(qty)) continue
    if (weight <= 0 && qty <= 0) continue

    results.push({
      etf_product_id: productId,
      component_symbol: code,
      component_name: name,
      weight: !isNaN(weight) ? weight.toFixed(4) : null,
      shares: !isNaN(qty) ? Math.floor(qty) : null,
      snapshot_date: snapshotDate,
    })
  }

  return results
}

export class SamsungActiveAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const dateCompact = formatDateCompact(new Date(snapshotDate))
    const targetUrl = profile.download_url.replace(/gijunYMD=\d*/, `gijunYMD=${dateCompact}`)

    const response = await this.fetchFn(targetUrl, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0) return []

    const buffer = Buffer.from(arrayBuffer)
    return parseXlsBuffer(buffer, profile.product_id, snapshotDate)
  }
}
