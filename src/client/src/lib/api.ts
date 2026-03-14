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
  LatestPrice,
  PriceHistory,
  TaskExecution,
  EtfComponent,
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  HoldingWithDetails,
  RealizedPnlEntry,
  ExchangeRate,
} from '@shared/types'

const BASE_URL = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`서버 오류 (${response.status})`)
  }

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
    latestPrices: () => request<LatestPrice[]>('/products/latest-prices'),
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
    run: (from?: string) =>
      fetch(`${BASE_URL}/scheduler/price-collection/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: from ? JSON.stringify({ from }) : undefined,
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
  // PRD-FEAT-016: Exchange Rate Collection Scheduler
  exchangeRates: {
    list: () => request<ExchangeRate[]>('/exchange-rates'),
    getByCurrency: (currency: string) => request<ExchangeRate>(`/exchange-rates/${currency}`),
    update: () =>
      fetch(`${BASE_URL}/exchange-rates/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        const body = await res.json()
        if (!body.success) throw new Error(body.error ?? 'Unknown error')
        return body.data as ExchangeRate
      }),
  },
  exchangeRateScheduler: {
    status: () => request<TaskExecution[]>('/scheduler/exchange-rate/status'),
    run: () =>
      fetch(`${BASE_URL}/scheduler/exchange-rate/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        const body = await res.json()
        if (res.status === 409) throw new Error(body.error ?? '이미 실행 중입니다')
        if (!body.success) throw new Error(body.error ?? 'Unknown error')
        return body.data as { readonly message: string }
      }),
  },
  // PRD-FEAT-017: Holdings Price Collection Scheduler
  holdingsPriceScheduler: {
    status: () => request<TaskExecution[]>('/scheduler/holdings-price/status'),
    run: (period?: string) =>
      fetch(`${BASE_URL}/scheduler/holdings-price/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: period ?? '1D' }),
      }).then(async (res) => {
        const body = await res.json()
        if (res.status === 409) throw new Error(body.error ?? '이미 실행 중입니다')
        if (!body.success) throw new Error(body.error ?? 'Unknown error')
        return body.data as { readonly message: string }
      }),
  },
  // PRD-FEAT-014: Holdings Management
  transactions: {
    list: (params?: {
      account_id?: number
      product_id?: number
      type?: 'buy' | 'sell'
      from?: string
      to?: string
    }) => {
      const qs = new URLSearchParams()
      if (params?.account_id) qs.set('account_id', String(params.account_id))
      if (params?.product_id) qs.set('product_id', String(params.product_id))
      if (params?.type) qs.set('type', params.type)
      if (params?.from) qs.set('from', params.from)
      if (params?.to) qs.set('to', params.to)
      const query = qs.toString()
      return request<Transaction[]>(`/transactions${query ? `?${query}` : ''}`)
    },
    getById: (id: number) => request<Transaction>(`/transactions/${id}`),
    create: (input: CreateTransactionPayload) =>
      request<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: number, input: UpdateTransactionPayload) =>
      request<Transaction>(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: number) =>
      request<null>(`/transactions/${id}`, { method: 'DELETE' }),
  },
  holdings: {
    list: (params?: { account_id?: number; family_member_id?: number }) => {
      const qs = new URLSearchParams()
      if (params?.account_id) qs.set('account_id', String(params.account_id))
      if (params?.family_member_id) qs.set('family_member_id', String(params.family_member_id))
      const query = qs.toString()
      return request<HoldingWithDetails[]>(`/holdings${query ? `?${query}` : ''}`)
    },
    realizedPnl: (params?: {
      account_id?: number
      family_member_id?: number
      from?: string
      to?: string
    }) => {
      const qs = new URLSearchParams()
      if (params?.account_id) qs.set('account_id', String(params.account_id))
      if (params?.family_member_id) qs.set('family_member_id', String(params.family_member_id))
      if (params?.from) qs.set('from', params.from)
      if (params?.to) qs.set('to', params.to)
      const query = qs.toString()
      return request<RealizedPnlEntry[]>(`/holdings/realized-pnl${query ? `?${query}` : ''}`)
    },
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
