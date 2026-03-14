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

// PRD-FEAT-004: Product list latest price & returns
export interface LatestPrice {
  readonly product_id: number
  readonly close: string
  readonly date: string
  readonly return_1w: number | null
  readonly return_1m: number | null
  readonly return_3m: number | null
  readonly return_1y: number | null
}

// PRD-FEAT-005: Price History Scheduler
export interface PriceHistory {
  readonly id: number
  readonly product_id: number
  readonly date: string
  readonly open: string | null
  readonly high: string | null
  readonly low: string | null
  readonly close: string
  readonly volume: number | null
  readonly created_at: string
}

export interface ScheduledTask {
  readonly id: number
  readonly name: string
  readonly cron_expression: string
  readonly enabled: boolean
  readonly created_at: string
  readonly updated_at: string
}

export interface TaskExecution {
  readonly id: number
  readonly task_id: number
  readonly started_at: string
  readonly finished_at: string | null
  readonly status: 'running' | 'success' | 'partial' | 'failed' | 'aborted'
  readonly products_total: number
  readonly products_succeeded: number
  readonly products_failed: number
  readonly products_skipped: number
  readonly message: string | null
  readonly created_at: string
}

// PRD-FEAT-010: Account Management
export interface Account {
  readonly id: number
  readonly account_name: string
  readonly account_number: string | null
  readonly family_member_id: number
  readonly institution_id: number
  readonly account_type_id: number
  readonly created_at: string
  readonly updated_at: string
}

export interface AccountWithDetails {
  readonly id: number
  readonly account_name: string
  readonly account_number: string | null
  readonly family_member_id: number
  readonly family_member_name: string
  readonly institution_id: number
  readonly institution_name: string
  readonly account_type_id: number
  readonly account_type_name: string
  readonly account_type_short_code: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateAccountPayload {
  readonly account_name: string
  readonly account_number?: string | null
  readonly family_member_id: number
  readonly institution_id: number
  readonly account_type_id: number
}

export interface UpdateAccountPayload {
  readonly account_name?: string
  readonly account_number?: string | null
  readonly family_member_id?: number
  readonly institution_id?: number
  readonly account_type_id?: number
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

// PRD-FEAT-012: ETF Component Collection Scheduler
export type EtfManager = 'samsung-active' | 'timefolio' | 'rise' | 'kodex'

export interface EtfProfile {
  readonly id: number
  readonly product_id: number
  readonly manager: EtfManager
  readonly expense_ratio: string | null
  readonly download_url: string
  readonly download_type: 'xls' | 'html' | 'json'
  readonly created_at: string
  readonly updated_at: string
}

export interface EtfComponent {
  readonly id: number
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null
  readonly shares: number | null
  readonly snapshot_date: string
  readonly created_at: string
}

export interface CreateEtfComponentPayload {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight?: string | null
  readonly shares?: number | null
  readonly snapshot_date: string
}

// PRD-FEAT-014: Holdings Management
export interface Transaction {
  readonly id: number
  readonly account_id: number
  readonly product_id: number
  readonly type: 'buy' | 'sell'
  readonly shares: string
  readonly price: string
  readonly fee: string
  readonly tax: string
  readonly traded_at: string
  readonly memo: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateTransactionPayload {
  readonly account_id: number
  readonly product_id: number
  readonly type: 'buy' | 'sell'
  readonly shares: number
  readonly price: number
  readonly fee?: number
  readonly tax?: number
  readonly traded_at: string
  readonly memo?: string
}

// account_id and product_id are immutable after creation.
// To change them, delete and re-create the transaction.
export interface UpdateTransactionPayload {
  readonly type?: 'buy' | 'sell'
  readonly shares?: number
  readonly price?: number
  readonly fee?: number
  readonly tax?: number
  readonly traded_at?: string
  readonly memo?: string
}

export interface HoldingWithDetails {
  readonly account_id: number
  readonly product_id: number
  readonly product_name: string
  readonly asset_type: string
  readonly currency: string
  readonly exchange: string | null
  readonly shares: number
  readonly avg_cost: number
  readonly current_price: number | null
  readonly fx_rate: number | null
  readonly market_value: number | null
  readonly cost_basis: number
  readonly unrealized_pnl: number | null
  readonly unrealized_pnl_percent: number | null
  readonly weight: number | null
  readonly account_name: string
  readonly institution_name: string
  readonly family_member_name: string
}

export interface RealizedPnlEntry {
  readonly transaction_id: number
  readonly traded_at: string
  readonly product_id: number
  readonly product_name: string
  readonly shares: number
  readonly sell_price: number
  readonly avg_cost_at_sell: number
  readonly gross_pnl: number
  readonly fee: number
  readonly tax: number
  readonly net_pnl: number
}
