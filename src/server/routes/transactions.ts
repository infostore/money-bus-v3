// PRD-FEAT-014: Holdings Management — Transaction Routes
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { TransactionRepository } from '../database/transaction-repository.js'
import type { HoldingService } from '../services/holding-service.js'
import type { ApiResponse, Transaction } from '../../shared/types.js'

const PG_FK_VIOLATION = '23503'

function createSchemas() {
  return {
    create: z.object({
      account_id: z.number().int().positive('계좌를 선택해주세요.'),
      product_id: z.number().int().positive('종목을 선택해주세요.'),
      type: z.enum(['buy', 'sell'], { error: '거래유형은 buy 또는 sell이어야 합니다.' }),
      shares: z.number().positive('수량은 0보다 커야 합니다.'),
      price: z.number().positive('가격은 0보다 커야 합니다.'),
      fee: z.number().min(0, '수수료는 0 이상이어야 합니다.').optional(),
      tax: z.number().min(0, '세금은 0 이상이어야 합니다.').optional(),
      traded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '거래일은 YYYY-MM-DD 형식이어야 합니다.'),
      memo: z.string().max(500).optional(),
    }),
    update: z
      .object({
        type: z.enum(['buy', 'sell']).optional(),
        shares: z.number().positive('수량은 0보다 커야 합니다.').optional(),
        price: z.number().positive('가격은 0보다 커야 합니다.').optional(),
        fee: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        traded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '거래일은 YYYY-MM-DD 형식이어야 합니다.').optional(),
        memo: z.string().max(500).optional(),
      })
      .refine((obj) => Object.keys(obj).length > 0, '수정할 필드를 하나 이상 입력해주세요.'),
  }
}

function parseJsonBody(raw: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, error: '요청 본문이 비어있습니다.' }
  }
  return { ok: true, data: raw }
}

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ')
}

export function createTransactionRoutes(
  repo: TransactionRepository,
  holdingService: HoldingService,
): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  // GET / — list with optional filters
  app.get('/', async (c) => {
    const accountId = c.req.query('account_id')
    const productId = c.req.query('product_id')
    const type = c.req.query('type')
    const from = c.req.query('from')
    const to = c.req.query('to')

    if (type && type !== 'buy' && type !== 'sell') {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '거래유형은 buy 또는 sell이어야 합니다.' },
        400,
      )
    }

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'from은 YYYY-MM-DD 형식이어야 합니다.' },
        400,
      )
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'to는 YYYY-MM-DD 형식이어야 합니다.' },
        400,
      )
    }

    const data = await repo.findAll({
      account_id: accountId ? parseInt(accountId, 10) : undefined,
      product_id: productId ? parseInt(productId, 10) : undefined,
      type: type as 'buy' | 'sell' | undefined,
      from: from ?? undefined,
      to: to ?? undefined,
    })

    return c.json<ApiResponse<readonly Transaction[]>>({ success: true, data, error: null })
  })

  // GET /:id
  app.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 ID입니다.' },
        400,
      )
    }

    const data = await repo.findById(id)
    if (!data) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '거래를 찾을 수 없습니다.' },
        404,
      )
    }

    return c.json<ApiResponse<Transaction>>({ success: true, data, error: null })
  })

  // POST / — create transaction
  app.post('/', async (c) => {
    const raw = parseJsonBody(await c.req.json().catch(() => null))
    if (!raw.ok) {
      return c.json<ApiResponse<null>>({ success: false, data: null, error: raw.error }, 400)
    }

    const parsed = schemas.create.safeParse(raw.data)
    if (!parsed.success) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: formatZodError(parsed.error) },
        400,
      )
    }

    const input = parsed.data

    // Sell validation: check held shares
    if (input.type === 'sell') {
      const result = await holdingService.validateSell(
        input.account_id,
        input.product_id,
        input.shares,
      )
      if (!result.valid) {
        return c.json<ApiResponse<null>>(
          {
            success: false,
            data: null,
            error: `보유수량(${result.heldShares}주)을 초과하여 매도할 수 없습니다`,
          },
          400,
        )
      }
    }

    try {
      const data = await repo.create(input)
      return c.json<ApiResponse<Transaction>>({ success: true, data, error: null }, 201)
    } catch (err) {
      if (isPgError(err, PG_FK_VIOLATION)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '참조하는 계좌 또는 종목이 존재하지 않습니다.' },
          400,
        )
      }
      throw err
    }
  })

  // PUT /:id — update transaction
  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 ID입니다.' },
        400,
      )
    }

    const existing = await repo.findById(id)
    if (!existing) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '거래를 찾을 수 없습니다.' },
        404,
      )
    }

    const raw = parseJsonBody(await c.req.json().catch(() => null))
    if (!raw.ok) {
      return c.json<ApiResponse<null>>({ success: false, data: null, error: raw.error }, 400)
    }

    const parsed = schemas.update.safeParse(raw.data)
    if (!parsed.success) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: formatZodError(parsed.error) },
        400,
      )
    }

    // Build what the transaction would look like after update
    const afterUpdate = {
      ...existing,
      type: parsed.data.type ?? existing.type,
      shares: parsed.data.shares !== undefined ? String(parsed.data.shares) : existing.shares,
      price: parsed.data.price !== undefined ? String(parsed.data.price) : existing.price,
      fee: parsed.data.fee !== undefined ? String(parsed.data.fee) : existing.fee,
      tax: parsed.data.tax !== undefined ? String(parsed.data.tax) : existing.tax,
      traded_at: parsed.data.traded_at ?? existing.traded_at,
      memo: parsed.data.memo ?? existing.memo,
    }

    // Get all transactions for this account+product, replace the one being edited
    const allTxns = await repo.findAll({
      account_id: existing.account_id,
      product_id: existing.product_id,
    })
    const modifiedTxns = allTxns
      .map((t) => (t.id === id ? afterUpdate : t))
      .sort((a, b) => a.traded_at.localeCompare(b.traded_at) || a.id - b.id)

    const integrity = await holdingService.validateHistoryIntegrity(modifiedTxns)
    if (!integrity.valid) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          error: `수정 후 거래내역에서 보유수량이 음수가 됩니다 (${integrity.negativeDate})`,
        },
        400,
      )
    }

    const data = await repo.update(id, parsed.data)
    return c.json<ApiResponse<Transaction>>({ success: true, data: data!, error: null })
  })

  // DELETE /:id
  app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 ID입니다.' },
        400,
      )
    }

    const existing = await repo.findById(id)
    if (!existing) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '거래를 찾을 수 없습니다.' },
        404,
      )
    }

    // Validate deletion won't cause negative shares
    const allTxns = await repo.findAll({
      account_id: existing.account_id,
      product_id: existing.product_id,
    })
    const afterDeletion = allTxns
      .filter((t) => t.id !== id)
      .sort((a, b) => a.traded_at.localeCompare(b.traded_at) || a.id - b.id)

    const integrity = await holdingService.validateHistoryIntegrity(afterDeletion)
    if (!integrity.valid) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          error: `수정 후 거래내역에서 보유수량이 음수가 됩니다 (${integrity.negativeDate})`,
        },
        400,
      )
    }

    await repo.delete(id)
    return c.json<ApiResponse<null>>({ success: true, data: null, error: null })
  })

  return app
}

function isPgError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === code
  )
}
