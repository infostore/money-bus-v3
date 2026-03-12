import type {
  ApiResponse,
  ItemData,
  ItemSummary,
  CreateItemPayload,
} from '@shared/types'

const BASE_URL = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  const result: ApiResponse<T> = await response.json()

  if (!result.success) {
    throw new Error(result.error ?? 'Unknown error')
  }

  return result.data as T
}

export const api = {
  items: {
    list: () => request<ItemData[]>('/items'),
    summary: () => request<ItemSummary>('/items/summary'),
    create: (input: CreateItemPayload) =>
      request<ItemData>('/items', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<boolean>(`/items/${id}`, { method: 'DELETE' }),
  },
  settings: {
    getAll: () => request<Record<string, string>>('/settings'),
    set: (key: string, value: string) =>
      request<boolean>('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      }),
  },
}
