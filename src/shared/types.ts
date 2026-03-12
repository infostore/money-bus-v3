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

export interface FamilyMember {
  readonly id: number
  readonly name: string
  readonly relationship: string
  readonly birth_year: number | null
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateFamilyMemberPayload {
  readonly name: string
  readonly relationship?: string
  readonly birth_year?: number
}

export interface UpdateFamilyMemberPayload {
  readonly name?: string
  readonly relationship?: string
  readonly birth_year?: number
}

// PRD-FEAT-002: Institution Management
export interface Institution {
  readonly id: number
  readonly name: string
  readonly category: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateInstitutionPayload {
  readonly name: string
  readonly category?: string
}

export interface UpdateInstitutionPayload {
  readonly name?: string
  readonly category?: string
}

// PRD-FEAT-004: Product Management
export interface Product {
  readonly id: number
  readonly name: string
  readonly code: string | null
  readonly asset_type: string
  readonly currency: string
  readonly exchange: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateProductPayload {
  readonly name: string
  readonly code?: string | null
  readonly asset_type?: string
  readonly currency?: string
  readonly exchange?: string | null
}

export interface UpdateProductPayload {
  readonly name?: string
  readonly code?: string | null
  readonly asset_type?: string
  readonly currency?: string
  readonly exchange?: string | null
}

// PRD-FEAT-003: Account Type Management
export interface AccountType {
  readonly id: number
  readonly name: string
  readonly short_code: string | null
  readonly tax_treatment: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateAccountTypePayload {
  readonly name: string
  readonly short_code?: string
  readonly tax_treatment?: string
}

export interface UpdateAccountTypePayload {
  readonly name?: string
  readonly short_code?: string | null
  readonly tax_treatment?: string
}
