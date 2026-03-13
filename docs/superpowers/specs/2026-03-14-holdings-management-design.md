# Holdings Management (보유종목 관리) — Design Spec

## Context

Money-bus-v1 had a direct holdings table where users manually entered symbol, shares, and avg_cost. v3 needs this feature but with a fundamentally different approach: **transaction-based holdings computation**.

Instead of storing holdings directly, we store buy/sell transactions and compute holdings, average cost, and P&L on the fly via aggregation queries. This ensures data integrity — holdings always reflect the actual trade history.

## Design

### Data Model

A single new table: `transactions`.

```sql
CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type        TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  shares      NUMERIC(18, 6) NOT NULL,
  price       NUMERIC(18, 4) NOT NULL,
  fee         NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax         NUMERIC(18, 4) NOT NULL DEFAULT 0,
  traded_at   DATE NOT NULL,
  memo        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Key decisions:
- **`product_id` FK** (not `symbol` like v1) — v3 uses integer PKs for products
- **`NUMERIC` precision** — matches v3's existing `priceHistory` pattern for financial data
- **`ON DELETE RESTRICT`** — cannot delete an account or product that has transactions
- **No unique constraint on (account_id, product_id)** — multiple transactions per pair is the whole point

### Holdings Computation (View-Based)

Holdings are **not stored** — they are computed from transactions at query time.

For a given (account_id, product_id) pair:
- `shares` = SUM of buy shares - SUM of sell shares
- `avg_cost` = computed via moving average method (requires sequential processing)

**Moving average algorithm:**
```
For each transaction ordered by traded_at, id:
  if BUY:
    total_cost = (held_shares * avg_cost) + (new_shares * price)
    held_shares += new_shares
    avg_cost = total_cost / held_shares
  if SELL:
    realized_pnl += (price - avg_cost) * sell_shares - fee - tax
    held_shares -= sell_shares
    (avg_cost unchanged)
```

This cannot be a simple SQL aggregation — it requires ordered sequential processing. The repository will fetch transactions ordered by (traded_at, id) and compute in TypeScript.

### Computed Output Types

**HoldingComputed** — per (account, product):
- shares, avg_cost, market_value, cost_basis
- unrealized_pnl, unrealized_pnl_percent
- weight (% of filtered total)

**HoldingWithDetails** — enriched with joins:
- product_name, asset_type, currency, exchange
- current_price (latest from price_history), fx_rate
- account_name, institution_name, family_member_name

**RealizedPnlEntry** — per sell transaction:
- traded_at, shares, sell_price, avg_cost_at_sell
- gross_pnl, fee, tax, net_pnl

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List transactions (filter: account_id, product_id, type, date range) |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/holdings` | Computed holdings with P&L (filter: account_id, family_member_id) |
| GET | `/api/holdings/realized-pnl` | Realized P&L summary (filter: account_id, family_member_id, date range) |

**Validation rules:**
- POST/PUT: shares > 0, price >= 0, fee >= 0, tax >= 0
- Sell validation: cannot sell more shares than currently held (computed at time of request)

### Frontend

**One new page: `/holdings` (보유종목)**

Layout:
- Filter bar: account selector, family member selector
- Holdings table: 종목명, 보유수량, 평균단가, 현재가, 평가금액, 손익(미실현), 수익률
- Realized P&L section: 실현손익 요약 (total) + detail toggle
- Transaction input: modal/dialog for adding buy/sell transactions

Navigation: Add to existing sidebar under appropriate group.

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
