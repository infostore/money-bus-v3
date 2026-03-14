---
type: prd
prd-id: PRD-FEAT-014
prd-type: feature
title: Holdings Management (보유종목 관리)
status: draft
implementation-status: not-started
created: 2026-03-14
updated: 2026-03-14
author: -
tags: [prd, holdings, transactions, portfolio]
---

# Feature: Holdings Management (보유종목 관리)

## 1. Overview

Money-bus-v1 had a direct holdings table where users manually entered symbol, shares, and average cost. v3 takes a fundamentally different approach: **transaction-based holdings computation**.

Instead of storing holdings directly, users record buy/sell transactions (매매내역) and the system computes holdings, average cost (이동평균법), and P&L automatically. This ensures data integrity — holdings always reflect the actual trade history. Both unrealized and realized P&L are computed, with buy-side fees/taxes included in cost basis and sell-side fees/taxes deducted from proceeds.

This is a core feature that unlocks portfolio-level analysis, enabling users to see their current positions, average costs, market values, and profit/loss across all accounts and family members.

## 2. User Stories

- As a user, I want to record buy/sell transactions so that my holdings are automatically computed.
- As a user, I want to view my current holdings with P&L so that I can monitor portfolio performance.
- As a user, I want to filter holdings by account or family member so that I can focus on specific portfolios.
- As a user, I want to see both unrealized and realized P&L so that I can understand total investment returns.

## 3. Scope

### In Scope
- Transaction (매매내역) CRUD — buy/sell with shares, price, fee, tax
- Holdings computation via moving average method (이동평균법)
- Holdings page with unrealized P&L display
- Realized P&L computation and display
- Filtering by account and family member
- FX rate conversion for foreign currency holdings

### Out of Scope
- Dividend/interest tracking
- FIFO cost basis method
- Portfolio summary dashboard
- Import from CSV/broker
- Transaction history standalone page
- Bulk transaction creation

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | As a user, I want to create a buy transaction | Given I select an account and product, when I enter shares, price, fee, tax, and date, then the transaction is saved and holdings are updated |
| 2 | As a user, I want to create a sell transaction | Given I have holdings in a product, when I enter a sell transaction with more shares than held, then the API returns 400 with error "보유수량(X주)을 초과하여 매도할 수 없습니다". When valid, the transaction is saved. |
| 3 | As a user, I want to edit a transaction | Given I edit a transaction, when the edit would cause negative shares at any point in history, then the API returns 400 with error "수정 후 거래내역에서 보유수량이 음수가 됩니다 (YYYY-MM-DD)". When valid, the transaction is saved and holdings are recomputed. |
| 4 | As a user, I want to delete a transaction | Given I delete a transaction, when confirmed, then it is removed and holdings are recomputed. If deletion would cause negative shares, API returns 400 with the same error as Story #3. |
| 5 | As a user, I want to view holdings with P&L | Given I have transactions, when I open /holdings, then I see 종목명, 보유수량, 평균단가, 현재가, 평가금액, 미실현손익, 수익률. When no price_history exists for a product, current_price shows 0 and 평가금액/손익 columns show "-". |
| 6 | As a user, I want to filter holdings | Given I select an account or family member filter, then only matching holdings are shown. When no holdings match, display "선택한 조건에 해당하는 보유종목이 없습니다". |
| 7 | As a user, I want to view realized P&L | Given I am on the /holdings page, when I click the "실현손익" section toggle, then I see a collapsible table of per-sell-transaction realized gains/losses below the holdings table. |
| 8 | As a user, I want foreign holdings in KRW | Given I hold a USD product, when viewing holdings, then market_value and cost_basis are converted using FX rate. Values are displayed in KRW with the original currency indicated. |

## 5. Technical Design

### Data Model

Single new table: `transactions`

```typescript
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'restrict' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  type: text('type').notNull().$type<'buy' | 'sell'>(),  // enforced via CHECK constraint in migration
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

Design decisions:
- `product_id` FK (not `symbol` like v1) — v3 uses integer PKs
- `NUMERIC` precision matches existing `priceHistory` pattern
- `ON DELETE RESTRICT` — cannot delete account/product with transactions
- Composite index on `(account_id, product_id, traded_at)` for computation query
- `updatedAt` set explicitly in repository `update()` method
- `type` column: `$type<'buy' | 'sell'>()` for TypeScript safety + `CHECK (type IN ('buy', 'sell'))` in migration SQL for DB-level enforcement
- `traded_at` is `date` (not timestamp) — same-day transactions are ordered by `id` (insertion order). UI warns users editing backdated transactions that full history recomputation will occur.

### Holdings Computation

Holdings are **not stored** — computed from transactions at query time (view-based approach).

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

Fee/tax treatment:
- **Buy-side**: added to cost basis (increases avg_cost) — Korean brokerage standard
- **Sell-side**: deducted from sale proceeds (reduces realized P&L)

Edge cases:
- Sell to zero then re-buy: avg_cost resets to new buy price
- Transaction edit causing negative shares: validated on PUT — reject if any point in history goes negative

### Shared Types

```typescript
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
  readonly current_price: number | null  // null when no price_history exists
  readonly fx_rate: number | null      // null when FX data missing for foreign currency
  readonly market_value: number | null  // null when current_price or fx_rate is null
  readonly cost_basis: number
  readonly unrealized_pnl: number | null
  readonly unrealized_pnl_percent: number | null
  readonly weight: number
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
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List transactions (query: ?account_id=&product_id=&type=&from=&to=) |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/holdings` | Computed holdings with P&L (query: ?account_id=&family_member_id=) |
| GET | `/api/holdings/realized-pnl` | Realized P&L list (query: ?account_id=&family_member_id=&from=&to=) |

Validation rules:
- POST/PUT: shares > 0, price > 0, fee >= 0, tax >= 0
- Sell: cannot sell more shares than currently held
- PUT: recompute holdings after edit; reject if negative shares at any history point

### Architecture

```
[Frontend]
  /holdings page → useHoldings() + useTransactions() (TanStack Query)
                 → TransactionFormDialog component

[API]
  /api/transactions → TransactionRepository (CRUD)
  /api/holdings     → HoldingService (computation logic)
                      → TransactionRepository.findByAccount()
                      → PriceHistoryRepository.findLatestByProductIds(productIds)  // new method

[Database]
  transactions table (single source of truth)
```

- `TransactionRepository` — pure CRUD on transactions table
- `HoldingService` — fetches transactions, computes holdings + P&L via moving average, joins with latest prices

**FX rate lookup convention:**
- FX products are stored as regular products with code format `FX:{FROM}{TO}` where TO is always `KRW` (e.g., `FX:USDKRW`, `FX:JPYKRW`)
- `HoldingService` maps `currency → FX product code`: if `currency !== 'KRW'`, look up product where `code = 'FX:{currency}KRW'`, then get latest close from `price_history`
- KRW holdings: `fx_rate = 1.0`
- Missing FX data: `fx_rate = null`, market_value shows "-" in UI (not silently defaulted)
- A new method `PriceHistoryRepository.findLatestByProductIds(productIds: number[])` will be added to fetch latest close prices in bulk

**Weight calculation:** `weight = holding market_value / SUM of all market_value` within the filtered result set. Weight is **filter-relative** — when filtering by one account, weights sum to 100% within that account. UI indicates this with tooltip "비중은 필터 기준 합산 기준입니다".

### Frontend

Page: `/holdings` (보유종목) — add to `assets` NAV_GROUP in `navigation.ts`.

Layout:
- Filter bar: account selector, family member selector
- Holdings table: 종목명, 보유수량, 평균단가, 현재가, 평가금액, 손익(미실현), 수익률
- Realized P&L section: 실현손익 요약 + detail toggle
- Transaction input: modal/dialog for buy/sell recording

Distinct from `/portfolio` (summary dashboard) — `/holdings` shows individual position-level detail.

Transaction history: each holding row is expandable to show its transaction list inline (매매내역). Users can add/edit/delete transactions from this expanded view. A standalone transaction history page is out of scope.

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Schema + migration + TransactionRepository (CRUD) + shared types | Medium |
| 2 | HoldingService (moving avg computation + realized P&L) + API routes + sell validation in DB transaction | Medium |
| 3 | Frontend hooks (useHoldings, useTransactions) | Low |
| 4 | Holdings page UI (table + filters + transaction form dialog) | Medium |

## 7. Success Metrics

- [ ] Transaction CRUD works correctly (create, read, update, delete)
- [ ] Holdings computed accurately via moving average method. Canonical test: Buy 10@100 (fee=50) → avg_cost=10.5; Buy 10@110 (fee=50) → avg_cost=110.5; Sell 5@120 (fee=10, tax=20) → realized_pnl = (120×5 - 10 - 20) - (110.5×5) = 17.5
- [ ] Buy-side fees included in cost basis; sell-side fees deducted from proceeds
- [ ] Sell validation prevents over-selling
- [ ] PUT validation prevents negative shares at any history point
- [ ] Unrealized P&L displayed correctly with current prices
- [ ] Realized P&L computed correctly for all sell transactions
- [ ] FX rate conversion works for foreign currency holdings
- [ ] Filters by account and family member work correctly
- [ ] 80%+ test coverage on HoldingService computation logic

## 8. Dependencies

- PRD-FEAT-004: Product Management (products table)
- PRD-FEAT-005: Price History Scheduler (price_history for current prices and FX rates)
- PRD-FEAT-010: Account Management (accounts table with family_member FK)

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Moving average computation performance with many transactions | Slow holdings query | Personal use (~1000s of txns) — sequential processing is fast enough. Cache/materialize later if needed. |
| Sell validation race condition | Over-selling | Wrap sell creation in a DB transaction with holdings check |
| FX rate availability | Incorrect market_value for foreign holdings | Fall back to fx_rate=1.0 if no FX product exists |
| Transaction edit invalidating history | Data integrity | Recompute full history on PUT; reject if negative shares at any point |

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-14 | 1.0 | - | Initial PRD based on design spec |
| 2026-03-14 | 1.1 | - | Address review: DB-level type constraint, FX convention, error responses, nullable prices, test fixture |
