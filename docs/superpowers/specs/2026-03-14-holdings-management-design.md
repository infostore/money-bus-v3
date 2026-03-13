# Holdings Management (보유종목 관리) — Design Spec

## Context

Money-bus-v1 had a direct holdings table where users manually entered symbol, shares, and avg_cost. v3 needs this feature but with a fundamentally different approach: **transaction-based holdings computation**.

Instead of storing holdings directly, we store buy/sell transactions and compute holdings, average cost, and P&L on the fly via aggregation queries. This ensures data integrity — holdings always reflect the actual trade history.

## Design

### Data Model

A single new table: `transactions`.

```typescript
// Drizzle schema definition
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'restrict' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  type: text('type').notNull(),  // 'buy' | 'sell'
  shares: numeric('shares', { precision: 18, scale: 6 }).notNull(),
  price: numeric('price', { precision: 18, scale: 4 }).notNull(),
  fee: numeric('fee', { precision: 18, scale: 4 }).notNull().default('0'),
  tax: numeric('tax', { precision: 18, scale: 4 }).notNull().default('0'),
  tradedAt: date('traded_at').notNull(),
  memo: text('memo').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('transactions_account_product_date_idx').on(t.accountId, t.productId, t.tradedAt),
])
```

Key decisions:
- **`product_id` FK** (not `symbol` like v1) — v3 uses integer PKs for products
- **`NUMERIC` precision** — matches v3's existing `priceHistory` pattern for financial data
- **`ON DELETE RESTRICT`** — cannot delete an account or product that has transactions
- **No unique constraint on (account_id, product_id)** — multiple transactions per pair is the whole point
- **Composite index** on `(account_id, product_id, traded_at)` — optimizes the holdings computation query
- **`updatedAt`** — set explicitly in repository `update()` method via `new Date()`, no DB trigger

### Holdings Computation (View-Based)

Holdings are **not stored** — they are computed from transactions at query time.

For a given (account_id, product_id) pair:
- `shares` = SUM of buy shares - SUM of sell shares
- `avg_cost` = computed via moving average method (requires sequential processing)

**Moving average algorithm:**
```
For each transaction ordered by traded_at, id:
  if BUY:
    total_cost = (held_shares * avg_cost) + (new_shares * price + fee + tax)
    held_shares += new_shares
    avg_cost = total_cost / held_shares
  if SELL:
    realized_pnl += (price * sell_shares - fee - tax) - (avg_cost * sell_shares)
    held_shares -= sell_shares
    (avg_cost unchanged)
```

**Fee/tax treatment:**
- **Buy-side**: fees and taxes are added to cost basis (increases avg_cost)
- **Sell-side**: fees and taxes are deducted from sale proceeds (reduces realized P&L)
- This follows standard Korean brokerage practice

**Edge cases:**
- **Sell to zero then re-buy**: avg_cost resets to new buy price (correct — `0 * old_avg + new_shares * price`)
- **Transaction edit causing negative shares**: validated on PUT — recompute holdings from all transactions; reject if any point in history goes negative

This cannot be a simple SQL aggregation — it requires ordered sequential processing. The repository will fetch transactions ordered by (traded_at, id) and compute in TypeScript.

### Shared Types

```typescript
// Transaction entity
export interface Transaction {
  readonly id: number
  readonly account_id: number
  readonly product_id: number
  readonly type: 'buy' | 'sell'
  readonly shares: string       // NUMERIC as string (Drizzle convention)
  readonly price: string
  readonly fee: string
  readonly tax: string
  readonly traded_at: string    // DATE as ISO string
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

export interface UpdateTransactionPayload {
  readonly type?: 'buy' | 'sell'
  readonly shares?: number
  readonly price?: number
  readonly fee?: number
  readonly tax?: number
  readonly traded_at?: string
  readonly memo?: string
}

// Computed holdings (not stored)
export interface HoldingWithDetails {
  readonly account_id: number
  readonly product_id: number
  readonly product_name: string
  readonly asset_type: string
  readonly currency: string
  readonly exchange: string | null
  readonly shares: number
  readonly avg_cost: number
  readonly current_price: number
  readonly fx_rate: number
  readonly market_value: number       // shares * current_price * fx_rate
  readonly cost_basis: number         // shares * avg_cost (already includes buy-side fees)
  readonly unrealized_pnl: number     // market_value - cost_basis
  readonly unrealized_pnl_percent: number
  readonly weight: number             // % of total market_value across all filtered holdings
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
  readonly gross_pnl: number          // (sell_price - avg_cost) * shares
  readonly fee: number
  readonly tax: number
  readonly net_pnl: number            // gross_pnl - fee - tax
}
```

**FX rate lookup:** FX products (e.g., USD/KRW) are stored as regular products in the `products` table with prices in `price_history`. The `HoldingService` identifies FX products by currency: for KRW holdings, `fx_rate = 1.0`; for USD holdings, look up the latest close price of the product with `code = 'FX:USDKRW'` from `price_history`. If no FX product exists, fall back to `1.0`.

**Weight calculation:** `weight` = this holding's `market_value` / SUM of all `market_value` across the filtered result set (i.e., percentage by market value within the current filter context).

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List transactions (query: ?account_id=&product_id=&type=&from=&to=) |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/holdings` | Computed holdings with P&L (filter: account_id, family_member_id) |
| GET | `/api/holdings/realized-pnl` | Realized P&L list (query: ?account_id=&family_member_id=&from=&to=) |

**Validation rules:**
- POST/PUT: shares > 0, price > 0, fee >= 0, tax >= 0
- Sell validation: cannot sell more shares than currently held (computed at time of request)
- PUT validation: after edit, recompute all holdings for the (account, product) pair; reject if any point in transaction history results in negative shares

### Frontend

**One new page: `/holdings` (보유종목)**

Layout:
- Filter bar: account selector, family member selector
- Holdings table: 종목명, 보유수량, 평균단가, 현재가, 평가금액, 손익(미실현), 수익률
- Realized P&L section: 실현손익 요약 (total) + detail toggle
- Transaction input: modal/dialog for adding buy/sell transactions

Navigation: Add to `assets` NAV_GROUP in `navigation.ts`, alongside portfolio/accounts/products. This is distinct from the existing `/portfolio` page (which is a summary dashboard) — `/holdings` shows individual position-level detail with transaction history.

### Architecture Layers

```
[Frontend]
  /holdings page
    → useHoldings() hook (TanStack Query)
    → useTransactions() hook (TanStack Query)
    → Transaction form component

[API]
  /api/transactions → TransactionRepository (CRUD)
  /api/holdings → HoldingService (computation logic)
    → TransactionRepository.findByAccount()
    → PriceHistoryRepository.getLatestPrices()

[Database]
  transactions table (single source of truth)
  price_history table (for current prices, already exists)
  products table (for product details, already exists)
  accounts table (for account/member details, already exists)
```

### Why a HoldingService?

The moving average computation is business logic, not a simple query. A service layer between the route handler and repository keeps the computation testable and separates concerns:
- `TransactionRepository` — pure CRUD on transactions table
- `HoldingService` — fetches transactions, computes holdings + P&L, joins with latest prices

## Implementation Waves

| Wave | Scope | Effort |
|------|-------|--------|
| 1 | Schema + migration + TransactionRepository (CRUD) | Medium |
| 2 | HoldingService (moving avg computation + P&L) + API routes | Medium |
| 3 | Shared types + frontend hooks | Low |
| 4 | Holdings page UI (table + filters + transaction form) | Medium |

## Out of Scope (Future PRDs)

- Dividend/interest tracking
- FIFO cost basis method
- Portfolio summary dashboard
- Import from CSV/broker
- Transaction history page (standalone)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Moving average computation performance with many transactions | Slow holdings query | For personal use (~1000s of transactions), sequential processing is fast enough. Can cache/materialize later if needed. |
| Sell validation race condition | Over-selling | Wrap sell creation in a transaction with holdings check |
| FX rate availability | Incorrect market_value for foreign holdings | Fall back to 1.0 if no FX rate; v3 already has price_history for FX products |
