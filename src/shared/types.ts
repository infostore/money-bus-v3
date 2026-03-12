export interface ItemData {
  readonly id: number
  readonly name: string
  readonly value: number
  readonly category: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateItemPayload {
  readonly name: string
  readonly value: number
  readonly category?: string
}

export interface ItemSummary {
  readonly total: number
  readonly totalValue: number
  readonly categories: readonly string[]
}

export interface SettingsData {
  readonly [key: string]: string
}

export interface ApiResponse<T> {
  readonly success: boolean
  readonly data: T | null
  readonly error: string | null
}
