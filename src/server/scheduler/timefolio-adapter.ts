// PRD-FEAT-012: ETF Component Collection Scheduler
import * as XLSX from 'xlsx'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const REQUEST_TIMEOUT = 30_000

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
  Referer: 'https://timeetf.co.kr/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
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
 * Parse TIMEFOLIO Excel buffer.
 * Column layout: [종목코드, 종목명, 수량, 평가금액(원), 비중(%)]
 * Row 0 = header, rows 1+ = data.
 */
export function parseTimefolioXls(
  buffer: ArrayBuffer,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' })
  if (rows.length < 2) return []

  const results: EtfComponentRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (!cells || cells.length < 5) continue

    let code = String(cells[0] ?? '').trim()
    const name = String(cells[1] ?? '').trim()

    if (!name || name.includes('합계')) continue
    if (!code && name.includes('현금')) code = 'CASH'
    if (!code) continue

    code = cleanEquitySuffix(code)

    const isKr = /^\d{6}$/.test(code)
    const isForeign = /^[A-Z0-9]+$/.test(code) && code.length >= 2
    const isCash = code === 'CASH'
    if (!isKr && !isForeign && !isCash) continue

    const qty = parseNumeric(cells[2])
    const weight = parseNumeric(cells[4])

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

/**
 * Convert a Timefolio page URL to the Excel download URL.
 * m11_view.php?idx=12&cate=002 → pdf_excel.php?idx=12&cate=002
 */
function toExcelUrl(pageUrl: string): string {
  return pageUrl.replace(/m11_view\.php/, 'pdf_excel.php')
}

export class TimefolioAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    let targetUrl = toExcelUrl(profile.download_url)

    if (targetUrl.includes('pdfDate=')) {
      targetUrl = targetUrl.replace(/pdfDate=[\d-]*/, `pdfDate=${snapshotDate}`)
    } else {
      const sep = targetUrl.includes('?') ? '&' : '?'
      targetUrl = `${targetUrl}${sep}pdfDate=${snapshotDate}`
    }

    if (!targetUrl.includes('mode=')) {
      targetUrl += '&mode=pdf'
    }

    const response = await this.fetchFn(targetUrl, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0) return []

    return parseTimefolioXls(arrayBuffer, profile.product_id, snapshotDate)
  }
}
