// PRD-FEAT-016: Exchange Rate Collection Scheduler
import type { ExchangeRateRepository } from '../database/exchange-rate-repository.js'
import type { ExchangeRate } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

export const FALLBACK_USD_KRW = 1350

const EXIM_BASE_URL =
  'https://www.koreaexim.go.kr/site/program/financial/exchangeJSON'
const NAVER_FX_URL =
  'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW'
const REQUEST_TIMEOUT = 15_000

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

interface EximEntry {
  readonly cur_unit: string
  readonly deal_bas_r: string
}

export class ExchangeRateFetcher {
  constructor(
    private readonly exchangeRateRepo: ExchangeRateRepository,
    private readonly fetchFn: FetchFn = globalThis.fetch,
  ) {}

  async fetchUsdRate(): Promise<number> {
    const apiKey = process.env['EXIM_API_KEY']
    if (apiKey) {
      const rate = await this.fetchFromExim(apiKey)
      if (rate !== null) return rate
    }

    const naverRate = await this.fetchFromNaver()
    if (naverRate !== null) return naverRate

    log('warn', `All exchange rate sources failed. Using fallback: 1 USD = ${FALLBACK_USD_KRW} KRW`)
    return FALLBACK_USD_KRW
  }

  async updateUsdRate(): Promise<ExchangeRate> {
    const rate = await this.fetchUsdRate()
    const result = await this.exchangeRateRepo.upsert('USD', rate)
    log('info', `Exchange rate updated: 1 USD = ${rate} KRW`)
    return result
  }

  private async fetchFromExim(apiKey: string): Promise<number | null> {
    try {
      const today = new Date().toISOString().split('T')[0]?.replace(/-/g, '')
      const url = `${EXIM_BASE_URL}?authkey=${apiKey}&searchdate=${today}&data=AP01`

      const response = await this.fetchFn(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })
      if (!response.ok) throw new Error(`EXIM API error: HTTP ${response.status}`)

      const data = (await response.json()) as EximEntry[]
      const usd = data.find((item) => item.cur_unit === 'USD')
      if (!usd?.deal_bas_r) throw new Error('USD rate not found in EXIM response')

      const rate = parseFloat(usd.deal_bas_r.replace(/,/g, ''))
      if (isNaN(rate) || rate <= 0) throw new Error(`Invalid EXIM rate: ${usd.deal_bas_r}`)

      log('info', `Exchange rate from EXIM: 1 USD = ${rate} KRW`)
      return rate
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('warn', `EXIM fetch failed: ${msg}`)
      return null
    }
  }

  private async fetchFromNaver(): Promise<number | null> {
    try {
      const response = await this.fetchFn(NAVER_FX_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })
      if (!response.ok) throw new Error(`Naver fetch error: HTTP ${response.status}`)

      const html = await response.text()
      const rate = parseNaverRate(html)
      if (rate === null) throw new Error('Could not parse rate from Naver HTML')

      log('info', `Exchange rate from Naver: 1 USD = ${rate} KRW`)
      return rate
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('warn', `Naver fetch failed: ${msg}`)
      return null
    }
  }
}

function parseNaverRate(html: string): number | null {
  const todayMatch = html.match(/<p class="no_today">([\s\S]*?)<\/p>/)
  if (!todayMatch) return null

  const section = todayMatch[1]
  const digitMatches = [...section.matchAll(/<span class="no\d">(\d)<\/span>/g)]
  const digitValues = digitMatches.map((m) => m[1])
  if (digitValues.length === 0) return null

  const hasDot = section.includes('class="jum"')
  let rateStr: string

  if (hasDot && digitValues.length > 2) {
    const intPart = digitValues.slice(0, -2).join('')
    const decPart = digitValues.slice(-2).join('')
    rateStr = `${intPart}.${decPart}`
  } else {
    rateStr = digitValues.join('')
  }

  const rate = parseFloat(rateStr)
  return isNaN(rate) || rate <= 0 ? null : rate
}
