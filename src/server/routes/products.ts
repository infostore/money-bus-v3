// PRD-FEAT-004: Product Management
// PRD-FEAT-007: ETF Detail Page (price-history endpoint)
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { ProductRepository } from '../database/product-repository.js'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { ApiResponse, LatestPrice, PriceHistory, Product } from '../../shared/types.js'

const ASSET_TYPES = ['주식', 'ETF', '펀드', '채권', '예적금', '암호화폐', '기타'] as const

function createSchemas() {
  return {
    create: z.object({
      name: z
        .string()
        .trim()
        .min(1, '종목명을 입력해주세요.')
        .max(100, '종목명은 100자 이하여야 합니다.'),
      code: z.union([z.string().trim().max(20, '종목코드는 20자 이하여야 합니다.'), z.null()]).optional(),
      asset_type: z.enum(ASSET_TYPES).optional(),
      currency: z.string().trim().length(3, '통화코드는 3자여야 합니다.').optional(),
      exchange: z.union([z.string().trim().max(20, '거래소는 20자 이하여야 합니다.'), z.null()]).optional(),
    }),
    update: z
      .object({
        name: z
          .string()
          .trim()
          .min(1, '종목명을 입력해주세요.')
          .max(100, '종목명은 100자 이하여야 합니다.')
          .optional(),
        code: z.union([z.string().trim().max(20, '종목코드는 20자 이하여야 합니다.'), z.null()]).optional(),
        asset_type: z.enum(ASSET_TYPES).optional(),
        currency: z.string().trim().length(3, '통화코드는 3자여야 합니다.').optional(),
        exchange: z.union([z.string().trim().max(20, '거래소는 20자 이하여야 합니다.'), z.null()]).optional(),
      })
      .strict(),
  }
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_REGEX.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d.getTime())
}

const PG_UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  if ('code' in error && (error as { code: string }).code === PG_UNIQUE_VIOLATION) {
    return true
  }

  if ('cause' in error) {
    const cause = (error as { cause: unknown }).cause
    return (
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (cause as { code: string }).code === PG_UNIQUE_VIOLATION
    )
  }

  return false
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join('; ')
}

async function parseJsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

export function createProductRoutes(
  repo: ProductRepository,
  priceHistoryRepo?: PriceHistoryRepository,
): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly Product[]>>({
      success: true,
      data,
      error: null,
    })
  })

  // Latest prices for all products (must be before /:id param route)
  if (priceHistoryRepo) {
    app.get('/latest-prices', async (c) => {
      const priceMap = await priceHistoryRepo.findLatestPrices()
      const data: readonly LatestPrice[] = Array.from(priceMap.entries()).map(
        ([productId, { close, date }]) => ({ product_id: productId, close, date }),
      )
      return c.json<ApiResponse<readonly LatestPrice[]>>({
        success: true,
        data,
        error: null,
      })
    })
  }

  app.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 종목 ID입니다.' },
        400,
      )
    }

    const data = await repo.findById(id)

    if (!data) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '종목을 찾을 수 없습니다.' },
        404,
      )
    }

    return c.json<ApiResponse<Product>>({
      success: true,
      data,
      error: null,
    })
  })

  // PRD-FEAT-007: Price history for a product
  if (priceHistoryRepo) {
    app.get('/:id/price-history', async (c) => {
      const id = parseInt(c.req.param('id'), 10)

      if (isNaN(id)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '유효하지 않은 종목 ID입니다.' },
          400,
        )
      }

      const product = await repo.findById(id)

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

      const priceData = await priceHistoryRepo.findByProductIdInRange(id, from, to)

      return c.json<ApiResponse<readonly PriceHistory[]>>({
        success: true,
        data: priceData,
        error: null,
      })
    })
  }

  app.post('/', async (c) => {
    const body = await parseJsonBody(c)
    if (body === null) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid JSON body' },
        400,
      )
    }

    const parsed = schemas.create.safeParse(body)

    if (!parsed.success) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: formatZodError(parsed.error) },
        400,
      )
    }

    try {
      const data = await repo.create(parsed.data)
      return c.json<ApiResponse<Product>>(
        { success: true, data, error: null },
        201,
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 종목입니다.' },
          409,
        )
      }
      throw error
    }
  })

  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 종목 ID입니다.' },
        400,
      )
    }

    const body = await parseJsonBody(c)
    if (body === null) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid JSON body' },
        400,
      )
    }

    const parsed = schemas.update.safeParse(body)

    if (!parsed.success) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: formatZodError(parsed.error) },
        400,
      )
    }

    const { name, code, asset_type, currency, exchange } = parsed.data
    if (name === undefined && code === undefined && asset_type === undefined && currency === undefined && exchange === undefined) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '최소 하나의 필드를 입력해주세요.' },
        400,
      )
    }

    try {
      const data = await repo.update(id, parsed.data)

      if (!data) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '종목을 찾을 수 없습니다.' },
          404,
        )
      }

      return c.json<ApiResponse<Product>>({
        success: true,
        data,
        error: null,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 종목입니다.' },
          409,
        )
      }
      throw error
    }
  })

  app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 종목 ID입니다.' },
        400,
      )
    }

    const deleted = await repo.delete(id)

    if (!deleted) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '종목을 찾을 수 없습니다.' },
        404,
      )
    }

    return c.json<ApiResponse<null>>({
      success: true,
      data: null,
      error: null,
    })
  })

  return app
}
