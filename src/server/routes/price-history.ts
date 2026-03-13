// PRD-FEAT-007: ETF Detail Page - Price History Routes
import { Hono } from 'hono'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { ProductRepository } from '../database/product-repository.js'
import type { ApiResponse, PriceHistory } from '../../shared/types.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_REGEX.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d.getTime())
}

export function createPriceHistoryRoutes(
  priceHistoryRepo: PriceHistoryRepository,
  productRepo: ProductRepository,
): Hono {
  const app = new Hono()

  app.get('/:id/price-history', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 종목 ID입니다.' },
        400,
      )
    }

    const product = await productRepo.findById(id)

    if (!product) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '종목을 찾을 수 없습니다.' },
        404,
      )
    }

    const from = c.req.query('from')
    const to = c.req.query('to')

    if (from && !isValidDate(from)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        400,
      )
    }

    if (to && !isValidDate(to)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        400,
      )
    }

    if (from && to && from > to) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '시작일은 종료일보다 이전이어야 합니다.' },
        400,
      )
    }

    const data = await priceHistoryRepo.findByProductIdInRange(
      id,
      from ?? undefined,
      to ?? undefined,
    )

    return c.json<ApiResponse<readonly PriceHistory[]>>({
      success: true,
      data,
      error: null,
    })
  })

  return app
}
