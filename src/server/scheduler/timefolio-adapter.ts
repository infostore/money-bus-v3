// PRD-FEAT-012: ETF Component Collection Scheduler
import * as cheerio from 'cheerio'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

export function parseTimefolioHtml(
  html: string,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const $ = cheerio.load(html)
  const rows: EtfComponentRow[] = []

  $('table.holdings tbody tr').each((_i, el) => {
    const cells = $(el).find('td')
    if (cells.length < 4) return

    const symbol = $(cells[0]).text().trim()
    const name = $(cells[1]).text().trim()
    const rawWeight = $(cells[2]).text().trim()
    const rawShares = $(cells[3]).text().trim()

    if (!symbol) return

    const weightNum = parseFloat(rawWeight)
    const sharesNum = parseInt(rawShares, 10)

    rows.push({
      etf_product_id: productId,
      component_symbol: symbol,
      component_name: name,
      weight: !isNaN(weightNum) ? weightNum.toFixed(4) : null,
      shares: !isNaN(sharesNum) ? sharesNum : null,
      snapshot_date: snapshotDate,
    })
  })

  return rows
}

export class TimefolioAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const response = await this.fetchFn(profile.download_url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const html = await response.text()
    return parseTimefolioHtml(html, profile.product_id, snapshotDate)
  }
}
