// PRD-FEAT-001: Family Member Management
import { Hono } from 'hono'
import { z } from 'zod/v4'
import type { FamilyMemberRepository } from '../database/family-member-repository.js'
import type { ApiResponse, FamilyMember } from '../../shared/types.js'

function createSchemas() {
  const currentYear = new Date().getFullYear()
  return {
    create: z.object({
      name: z.string().trim().min(1).max(50),
      relationship: z
        .enum(['본인', '배우자', '자녀', '부모', '기타'])
        .optional(),
      birth_year: z.number().int().min(1900).max(currentYear).optional(),
    }),
    update: z.object({
      name: z.string().trim().min(1).max(50).optional(),
      relationship: z
        .enum(['본인', '배우자', '자녀', '부모', '기타'])
        .optional(),
      birth_year: z.number().int().min(1900).max(currentYear).optional(),
    }),
  }
}

const PG_UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  // Direct pg error
  if ('code' in error && (error as { code: string }).code === PG_UNIQUE_VIOLATION) {
    return true
  }

  // DrizzleQueryError wraps pg error in cause
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

export function createFamilyMemberRoutes(
  repo: FamilyMemberRepository,
): Hono {
  const app = new Hono()
  const schemas = createSchemas()

  app.get('/', async (c) => {
    const data = await repo.findAll()
    return c.json<ApiResponse<readonly FamilyMember[]>>({
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
      return c.json<ApiResponse<FamilyMember>>(
        { success: true, data, error: null },
        201,
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        return c.json<ApiResponse<null>>(
          {
            success: false,
            data: null,
            error: 'A family member with this name already exists',
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

    const { name, relationship, birth_year } = parsed.data
    if (name === undefined && relationship === undefined && birth_year === undefined) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'At least one field is required' },
        400,
      )
    }

    try {
      const data = await repo.update(id, parsed.data)

      if (!data) {
        return c.json<ApiResponse<null>>(
          { success: false, data: null, error: 'Family member not found' },
          404,
        )
      }

      return c.json<ApiResponse<FamilyMember>>({
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
            error: 'A family member with this name already exists',
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
        { success: false, data: null, error: 'Family member not found' },
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
