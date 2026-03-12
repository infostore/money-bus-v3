// PRD-FEAT-002: Institution Management
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { InstitutionRepository } from '../database/institution-repository.js'
import type { ApiResponse, Institution } from '../../shared/types.js'

const CATEGORY_OPTIONS = ['증권', '은행', '운용사'] as const

function createSchemas() {
  return {
    create: z.object({
      name: z.string().trim().min(1, '기관명을 입력해주세요.').max(100, '기관명은 100자 이하여야 합니다.'),
      category: z.enum(CATEGORY_OPTIONS).optional(),
    }),
    update: z
      .object({
        name: z.string().trim().min(1, '기관명을 입력해주세요.').max(100, '기관명은 100자 이하여야 합니다.').optional(),
        category: z.enum(CATEGORY_OPTIONS).optional(),
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

export function createInstitutionRoutes(
  repo: InstitutionRepository,
): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  app.get('/', async (c) => {
    const category = c.req.query('category')
    const data = await repo.findAll(category || undefined)
    return c.json<ApiResponse<readonly Institution[]>>({
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
      return c.json<ApiResponse<Institution>>(
        { success: true, data, error: null },
        201,
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          {
            success: false,
            data: null,
            error: '이미 등록된 기관명입니다.',
          },
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

    const { name, category } = parsed.data
    if (name === undefined && category === undefined) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'At least one field must be provided' },
        400,
      )
    }

    try {
      const data = await repo.update(id, parsed.data)

      if (!data) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: 'Institution not found' },
          404,
        )
      }

      return c.json<ApiResponse<Institution>>({
        success: true,
        data,
        error: null,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          {
            success: false,
            data: null,
            error: '이미 등록된 기관명입니다.',
          },
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
        { success: false, data: null, error: 'Institution not found' },
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
