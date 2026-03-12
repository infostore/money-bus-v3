import { Hono } from 'hono'
import type { ItemRepository } from '../database/repositories.js'
import type { CreateItemPayload, ApiResponse, ItemData, ItemSummary } from '../../shared/types.js'

export function createItemRoutes(items: ItemRepository): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const data = await items.findAll()
    return c.json<ApiResponse<readonly ItemData[]>>({ success: true, data, error: null })
  })

  app.get('/summary', async (c) => {
    const data = await items.getSummary()
    return c.json<ApiResponse<ItemSummary>>({ success: true, data, error: null })
  })

  app.post('/', async (c) => {
    const body = await c.req.json<CreateItemPayload>()

    if (!body.name || typeof body.value !== 'number') {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'name (string) and value (number) are required' },
        400,
      )
    }

    const data = await items.create(body)
    return c.json<ApiResponse<ItemData>>({ success: true, data, error: null }, 201)
  })

  app.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))

    if (isNaN(id)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Invalid id' },
        400,
      )
    }

    const deleted = await items.delete(id)

    if (!deleted) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Item not found' },
        404,
      )
    }

    return c.json<ApiResponse<boolean>>({ success: true, data: true, error: null })
  })

  return app
}
