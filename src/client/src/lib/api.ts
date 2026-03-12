import type {
  ApiResponse,
  ItemData,
  ItemSummary,
  CreateItemPayload,
  FamilyMember,
  CreateFamilyMemberPayload,
  UpdateFamilyMemberPayload,
  Institution,
  CreateInstitutionPayload,
  UpdateInstitutionPayload,
  AccountType,
  CreateAccountTypePayload,
  UpdateAccountTypePayload,
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
  // PRD-FEAT-001: Family Member Management
  familyMembers: {
    list: () => request<FamilyMember[]>('/family-members'),
    create: (input: CreateFamilyMemberPayload) =>
      request<FamilyMember>('/family-members', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateFamilyMemberPayload) =>
      request<FamilyMember>(`/family-members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/family-members/${id}`, { method: 'DELETE' }),
  },
  // PRD-FEAT-002: Institution Management
  institutions: {
    list: (category?: string) => {
      const params = category ? `?category=${encodeURIComponent(category)}` : ''
      return request<Institution[]>(`/institutions${params}`)
    },
    create: (input: CreateInstitutionPayload) =>
      request<Institution>('/institutions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateInstitutionPayload) =>
      request<Institution>(`/institutions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/institutions/${id}`, { method: 'DELETE' }),
  },
  // PRD-FEAT-003: Account Type Management
  accountTypes: {
    list: () => request<AccountType[]>('/account-types'),
    create: (input: CreateAccountTypePayload) =>
      request<AccountType>('/account-types', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateAccountTypePayload) =>
      request<AccountType>(`/account-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/account-types/${id}`, { method: 'DELETE' }),
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
