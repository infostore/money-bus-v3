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
  AccountWithDetails,
  CreateAccountPayload,
  UpdateAccountPayload,
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  PriceHistory,
  TaskExecution,
  EtfComponent,
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
  // PRD-FEAT-010: Account Management
  accounts: {
    list: () => request<AccountWithDetails[]>('/accounts'),
    create: (input: CreateAccountPayload) =>
      request<AccountWithDetails>('/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateAccountPayload) =>
      request<AccountWithDetails>(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/accounts/${id}`, { method: 'DELETE' }),
  },
  // PRD-FEAT-004: Product Management
  products: {
    list: () => request<Product[]>('/products'),
    getById: (id: number) => request<Product>(`/products/${id}`),
    getPriceHistory: (id: number, from?: string, to?: string) => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      return request<PriceHistory[]>(`/products/${id}/price-history${qs ? `?${qs}` : ''}`)
    },
    create: (input: CreateProductPayload) =>
      request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateProductPayload) =>
      request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/products/${id}`, { method: 'DELETE' }),
  },
  // PRD-FEAT-005: Price Scheduler
  // PRD-FEAT-008: Scheduler Execution History Delete
  scheduler: {
    status: () => request<TaskExecution[]>('/scheduler/price-collection/status'),
    run: () =>
      fetch(`${BASE_URL}/scheduler/price-collection/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        const body = await res.json()
        if (res.status === 409) {
          throw new Error(body.error ?? '이미 실행 중입니다')
        }
        if (!body.success) {
          throw new Error(body.error ?? 'Unknown error')
        }
        return body.data as { readonly run_id: number }
      }),
    stop: () =>
      request<null>('/scheduler/price-collection/stop', { method: 'POST' }),
    deleteExecution: (id: number) =>
      request<null>(`/scheduler/price-collection/executions/${id}`, {
        method: 'DELETE',
      }),
  },
  // PRD-FEAT-013: ETF Component UI
  etfComponents: {
    getDates: (productId: number) =>
      request<string[]>(`/etf-components/dates?productId=${productId}`),
    getByDate: (productId: number, snapshotDate: string) =>
      request<EtfComponent[]>(
        `/etf-components?productId=${productId}&snapshotDate=${snapshotDate}`,
      ),
  },
  // PRD-FEAT-013: ETF Component UI
  etfScheduler: {
    status: () => request<TaskExecution[]>('/scheduler/etf-components/status'),
    run: () =>
      fetch(`${BASE_URL}/scheduler/etf-components/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        const body = await res.json()
        if (res.status === 409) {
          throw new Error(body.error ?? '이미 실행 중입니다')
        }
        if (!body.success) {
          throw new Error(body.error ?? 'Unknown error')
        }
        return body.data as { readonly run_id: number }
      }),
    stop: () =>
      request<null>('/scheduler/etf-components/stop', { method: 'POST' }),
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
