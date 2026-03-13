// PRD-FEAT-012: ETF Component Collection Scheduler
import * as XLSX from 'xlsx'
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

function parseNumeric(value: string | number | null | undefined): number {
  if (value == null) return NaN
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim()
  return Number(cleaned)
}

/**
 * Parse Samsung XLS buffer using SheetJS (supports binary .xls format).
 * Row layout (0-indexed arrays from sheet_to_json):
 *   rows[1]: date string (e.g. "2026/03/13")
 *   rows[3]+: data — cells[1]=name, cells[3]=code, cells[4]=qty, cells[5]=weight
 */
export function parseXlsBuffer(
  buffer: ArrayBuffer,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' })
  if (rows.length < 4) return []

  const results: EtfComponentRow[] = []

  for (let i = 3; i < rows.length; i++) {
    const cells = rows[i]
    if (!cells || cells.length < 6) continue

    const name = String(cells[1] ?? '').trim()
    let code = String(cells[3] ?? '').trim()

    if (!name || name.includes('합계') || name.includes('예금')) continue

    code = cleanEquitySuffix(code)
    if (!code) continue

    const qty = parseNumeric(cells[4])
    let weight = parseNumeric(cells[5])

    // SheetJS returns Excel percentage-formatted cells as decimals (0.2341 for 23.41%)
    if (typeof cells[5] === 'number' && weight > 0 && weight < 1) {
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

    return parseXlsBuffer(arrayBuffer, profile.product_id, snapshotDate)
  }
}
