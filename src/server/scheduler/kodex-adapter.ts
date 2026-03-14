// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const REQUEST_TIMEOUT = 30_000

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.samsungfund.com/etf/product/view.do',
  'X-Requested-With': 'XMLHttpRequest',
}

interface KodexComponent {
  readonly secNm: string
  readonly itmNo: string
  readonly ratio: string | null
  readonly applyQ: string | null
}

export function parseKodexJson(
  components: readonly KodexComponent[],
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const results: EtfComponentRow[] = []

  for (const item of components) {
    const name = (item.secNm ?? '').trim()
    const code = (item.itmNo ?? '').trim()

    if (!name || !code) continue
    if (name.includes('예금') || name.includes('합계')) continue

    const weight = item.ratio != null ? parseFloat(item.ratio) : NaN
    const shares = item.applyQ != null ? parseInt(item.applyQ, 10) : NaN

    if (isNaN(weight) && isNaN(shares)) continue

    results.push({
      etf_product_id: productId,
      component_symbol: code,
      component_name: name,
      weight: !isNaN(weight) ? weight.toFixed(4) : null,
      shares: !isNaN(shares) ? Math.floor(shares) : null,
      snapshot_date: snapshotDate,
    })
  }

  return results
}

export class KodexAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const fId = profile.download_url
    const url = `https://www.samsungfund.com/api/v1/kodex/product/${fId}.do`

    const response = await this.fetchFn(url, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const data = await response.json() as { readonly pdf?: { readonly list?: readonly KodexComponent[] } }
    const components = data?.pdf?.list ?? []

    return parseKodexJson(components, profile.product_id, snapshotDate)
  }
}
