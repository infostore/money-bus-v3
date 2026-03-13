// PRD-FEAT-012: ETF Component Collection Scheduler
import { Hono } from 'hono'
import type { EtfComponentRepository } from '../database/etf-component-repository.js'
import type { ApiResponse, EtfComponent } from '../../shared/types.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function createEtfComponentRoutes(componentRepo: EtfComponentRepository): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const productIdStr = c.req.query('productId')
    const snapshotDate = c.req.query('snapshotDate')

    if (!productIdStr || isNaN(Number(productIdStr))) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'productId is required and must be numeric' },
        400,
      )
    }

    if (!snapshotDate) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'snapshotDate is required' },
        400,
      )
    }

    if (!DATE_REGEX.test(snapshotDate)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'snapshotDate must be YYYY-MM-DD format' },
        400,
      )
    }

    const data = await componentRepo.findByProductAndDate(Number(productIdStr), snapshotDate)
    return c.json<ApiResponse<readonly EtfComponent[]>>({ success: true, data, error: null })
  })

  app.get('/dates', async (c) => {
    const productIdStr = c.req.query('productId')

    if (!productIdStr || isNaN(Number(productIdStr))) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'productId is required and must be numeric' },
        400,
      )
    }

    const dates = await componentRepo.findDatesByProduct(Number(productIdStr))
    return c.json<ApiResponse<readonly string[]>>({ success: true, data: dates, error: null })
  })

  return app
}
