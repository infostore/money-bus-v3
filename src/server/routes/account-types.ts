// PRD-FEAT-003: Account Type Management
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { AccountTypeRepository } from '../database/account-type-repository.js'
import type { ApiResponse, AccountType } from '../../shared/types.js'

const TAX_TREATMENT_OPTIONS = ['세금우대', '일반', '연금'] as const

function createSchemas() {
  return {
    create: z.object({
      name: z
        .string()
        .trim()
        .min(1, '계좌유형명을 입력해주세요.')
        .max(100, '계좌유형명은 100자 이하여야 합니다.'),
      short_code: z.string().trim().max(20, '단축코드는 20자 이하여야 합니다.').optional(),
      tax_treatment: z.enum(TAX_TREATMENT_OPTIONS).optional(),
    }),
    update: z
      .object({
        name: z
          .string()
          .trim()
          .min(1, '계좌유형명을 입력해주세요.')
          .max(100, '계좌유형명은 100자 이하여야 합니다.')
          .optional(),
        short_code: z.union([z.string().trim().max(20, '단축코드는 20자 이하여야 합니다.'), z.null()]).optional(),
        tax_treatment: z.enum(TAX_TREATMENT_OPTIONS).optional(),
      })
      .strict(),
  }
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

export function createAccountTypeRoutes(repo: AccountTypeRepository): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly AccountType[]>>({
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
      return c.json<ApiResponse<AccountType>>(
        { success: true, data, error: null },
        201,
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 계좌유형입니다.' },
          409,
        )
      }
      throw error
    }
  })

  app.put('/:id', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid id' },
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

    const { name, short_code, tax_treatment } = parsed.data
    if (name === undefined && short_code === undefined && tax_treatment === undefined) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '최소 하나의 필드를 입력해주세요.' },
        400,
      )
    }

    try {
      const data = await repo.update(id, parsed.data)

      if (!data) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '계좌유형을 찾을 수 없습니다.' },
          404,
        )
      }

      return c.json<ApiResponse<AccountType>>({
        success: true,
        data,
        error: null,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: '이미 등록된 계좌유형입니다.' },
          409,
        )
      }
      throw error
    }
  })

  app.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid id' },
        400,
      )
    }

    const deleted = await repo.delete(id)

    if (!deleted) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: '계좌유형을 찾을 수 없습니다.' },
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
