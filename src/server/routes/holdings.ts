// PRD-FEAT-014: Holdings Management — Holdings Routes
import { Hono } from 'hono'
import type { HoldingService } from '../services/holding-service.js'
import type { ApiResponse, HoldingWithDetails, RealizedPnlEntry } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

export function createHoldingsRoutes(holdingService: HoldingService): Hono {
  const app = new Hono()

  // GET / — computed holdings with P&L
  app.get('/', async (c) => {
    const accountId = c.req.query('account_id')
    const familyMemberId = c.req.query('family_member_id')

    try {
      const data = await holdingService.getHoldings({
        account_id: accountId ? parseInt(accountId, 10) : undefined,
        family_member_id: familyMemberId ? parseInt(familyMemberId, 10) : undefined,
      })

      return c.json<ApiResponse<readonly HoldingWithDetails[]>>({
        success: true,
        data,
        error: null,
      })
    } catch (err) {
      log('error', `Holdings query failed: ${err}`)
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '보유종목 조회에 실패했습니다.' },
        500,
      )
    }
  })

  // GET /realized-pnl — realized P&L list
  app.get('/realized-pnl', async (c) => {
    const accountId = c.req.query('account_id')
    const familyMemberId = c.req.query('family_member_id')
    const from = c.req.query('from')
    const to = c.req.query('to')

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

    const data = await holdingService.getRealizedPnl({
      account_id: accountId ? parseInt(accountId, 10) : undefined,
      family_member_id: familyMemberId ? parseInt(familyMemberId, 10) : undefined,
      from: from ?? undefined,
      to: to ?? undefined,
    })

    return c.json<ApiResponse<readonly RealizedPnlEntry[]>>({
      success: true,
      data,
      error: null,
    })
  })

  return app
}
