// PRD-FEAT-016: Exchange Rate Collection Scheduler
import { Hono } from 'hono'
import type { ExchangeRateRepository } from '../database/exchange-rate-repository.js'
import type { ExchangeRateFetcher } from '../services/exchange-rate-fetcher.js'
import type { ApiResponse, ExchangeRate } from '../../shared/types.js'

export function createExchangeRateRoutes(
  repo: ExchangeRateRepository,
  fetcher: ExchangeRateFetcher,
): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly ExchangeRate[]>>({ success: true, data, error: null })
  })

  app.get('/:currency', async (c) => {
    const currency = c.req.param('currency').toUpperCase()
    const data = await repo.findByCurrency(currency)
    if (!data) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Currency not found' },
        404,
      )
    }
    return c.json<ApiResponse<ExchangeRate>>({ success: true, data, error: null })
  })

  app.post('/update', async (c) => {
    try {
      const data = await fetcher.updateUsdRate()
      return c.json<ApiResponse<ExchangeRate>>({ success: true, data, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update exchange rate'
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: message },
        500,
      )
    }
  })

  return app
}
