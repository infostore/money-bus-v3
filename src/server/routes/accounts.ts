// PRD-FEAT-010: Account Management
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { AccountRepository } from '../database/account-repository.js'
import type { ApiResponse, AccountWithDetails } from '../../shared/types.js'

const PG_UNIQUE_VIOLATION = '23505'
const PG_FK_VIOLATION = '23503'

function createSchemas() {
  return {
    create: z.object({
      account_name: z
        .string()
        .trim()
        .min(1, '계좌명을 입력해주세요.')
        .max(100, '계좌명은 100자 이하여야 합니다.'),
      account_number: z
        .union([z.string().trim().max(30, '계좌번호는 30자 이하여야 합니다.'), z.null()])
        .optional(),
      family_member_id: z.number().int().positive('구성원을 선택해주세요.'),
      institution_id: z.number().int().positive('금융기관을 선택해주세요.'),
      account_type_id: z.number().int().positive('계좌유형을 선택해주세요.'),
    }),
    update: z
      .object({
        account_name: z
          .string()
          .trim()
          .min(1, '계좌명을 입력해주세요.')
          .max(100, '계좌명은 100자 이하여야 합니다.')
          .optional(),
        account_number: z
          .union([z.string().trim().max(30, '계좌번호는 30자 이하여야 합니다.'), z.null()])
          .optional(),
        family_member_id: z.number().int().positive('구성원을 선택해주세요.').optional(),
        institution_id: z.number().int().positive('금융기관을 선택해주세요.').optional(),
        account_type_id: z.number().int().positive('계좌유형을 선택해주세요.').optional(),
      })
      .strict(),
  }
}

function isPgError(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false

  if ('code' in error && (error as { code: string }).code === code) {
    return true
  }

  if ('cause' in error) {
    const cause = (error as { cause: unknown }).cause
    return (
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (cause as { code: string }).code === code
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

export function createAccountRoutes(repo: AccountRepository): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly AccountWithDetails[]>>({
      success: true,
      data,
      error: null,
    })
  })

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
      return c.json<ApiResponse<AccountWithDetails>>(
        { success: true, data, error: null },
        201,
      )
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 계좌입니다.' },
          409,
        )
      }
      if (isPgError(error, PG_FK_VIOLATION)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '유효하지 않은 구성원/금융기관/계좌유형입니다.' },
          400,
        )
      }
      throw error
    }
  })

  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 계좌 ID입니다.' },
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

    const { account_name, account_number, family_member_id, institution_id, account_type_id } = parsed.data
    if (
      account_name === undefined &&
      account_number === undefined &&
      family_member_id === undefined &&
      institution_id === undefined &&
      account_type_id === undefined
    ) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '최소 하나의 필드를 입력해주세요.' },
        400,
      )
    }

    try {
      const data = await repo.update(id, parsed.data)

      if (!data) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '계좌를 찾을 수 없습니다.' },
          404,
        )
      }

      return c.json<ApiResponse<AccountWithDetails>>({
        success: true,
        data,
        error: null,
      })
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 계좌입니다.' },
          409,
        )
      }
      if (isPgError(error, PG_FK_VIOLATION)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '유효하지 않은 구성원/금융기관/계좌유형입니다.' },
          400,
        )
      }
      throw error
    }
  })

  app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '유효하지 않은 계좌 ID입니다.' },
        400,
      )
    }

    const deleted = await repo.delete(id)

    if (!deleted) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '계좌를 찾을 수 없습니다.' },
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
