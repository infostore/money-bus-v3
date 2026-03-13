// PRD-FEAT-012: ETF Component Collection Scheduler
import * as cheerio from 'cheerio'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const REQUEST_TIMEOUT = 30_000

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://timeetf.co.kr/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

function cleanEquitySuffix(code: string): string {
  return code.replace(/\s+[A-Z]{2}\s+EQUITY$/i, '').trim()
}

function parseNumeric(value: string): number {
  const cleaned = value.replace(/,/g, '').replace(/%/g, '').trim()
  return Number(cleaned)
}

/**
 * Parse TIMEFOLIO HTML — uses `table.table3.moreList1` selector.
 * Cell mapping: cells[0]=code, cells[1]=name, cells[2]=qty, cells[4]=weight
 */
export function parseTimefolioHtml(
  html: string,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const $ = cheerio.load(html)
  const rows: EtfComponentRow[] = []

  $('table.table3.moreList1 tr').each((_i, el) => {
    const cells = $(el).find('td')
    if (cells.length < 5) return

    let code = $(cells[0]).text().trim()
    const name = $(cells[1]).text().trim()

    if (!name || name.includes('합계')) return
    if (!code && name.includes('현금')) code = 'CASH'
    if (!code) return

    code = cleanEquitySuffix(code)

    const isKr = /^\d{6}$/.test(code)
    const isForeign = /^[A-Z0-9]+$/.test(code) && code.length >= 2
    const isCash = code === 'CASH'
    if (!isKr && !isForeign && !isCash) return

    const qty = parseNumeric($(cells[2]).text().trim())
    const weight = parseNumeric($(cells[4]).text().trim())

    if (weight <= 0 && qty <= 0) return

    rows.push({
      etf_product_id: productId,
      component_symbol: code,
      component_name: name,
      weight: !isNaN(weight) ? weight.toFixed(4) : null,
      shares: !isNaN(qty) ? Math.floor(qty) : null,
      snapshot_date: snapshotDate,
    })
  })

  return rows
}

export class TimefolioAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    let targetUrl = profile.download_url

    // Append pdfDate parameter
    if (targetUrl.includes('pdfDate=')) {
      targetUrl = targetUrl.replace(/pdfDate=[\d-]*/, `pdfDate=${snapshotDate}`)
    } else {
      const sep = targetUrl.includes('?') ? '&' : '?'
      targetUrl = `${targetUrl}${sep}pdfDate=${snapshotDate}`
    }

    // Append mode=pdf to get the actual component table
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

    const html = await response.text()
    return parseTimefolioHtml(html, profile.product_id, snapshotDate)
  }
}
