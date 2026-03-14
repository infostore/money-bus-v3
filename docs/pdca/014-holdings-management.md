---
type: pdca-plan
plan-name: Holdings Management (보유종목 관리)
related-prd: PRD-FEAT-014
phase: plan
status: not-started
created: 2026-03-14
updated: 2026-03-14
tags: [pdca, holdings, transactions, portfolio, pnl]
---

# PDCA Plan: Holdings Management (보유종목 관리)

## Plan

- **Goal**: Implement transaction-based holdings management — users record buy/sell transactions and the system automatically computes holdings, moving-average cost basis, unrealized P&L, and realized P&L. Includes full CRUD for transactions, a computed holdings API, and a `/holdings` page with filters and inline transaction history.

- **Scope**:
  - Wave 1: Shared types + Drizzle schema + migration + TransactionRepository (CRUD)
  - Wave 2: HoldingService (moving average computation, realized P&L, FX conversion) + new `PriceHistoryRepository.findLatestByProductIds()` + API routes (transactions + holdings)
  - Wave 3: Client API layer + TanStack Query hooks (useTransactions, useHoldings, useRealizedPnl)
  - Wave 4: Holdings page UI — filter bar, holdings table, realized P&L section, transaction form dialog, inline transaction list per holding row
  - Wave 5: Tests + verification

- **Success Metrics**:
  - [ ] Transaction CRUD works correctly (create, read, update, delete)
  - [ ] Moving average test fixture passes: Buy 10@100 (fee=50) → avg_cost=105.0; Buy 10@110 (fee=50) → avg_cost=110.0; Sell 5@120 (fee=10, tax=20) → realized_pnl=20.0
  - [ ] Buy-side fees included in cost basis; sell-side fees deducted from proceeds
  - [ ] Sell validation: over-selling returns 400 "보유수량(X주)을 초과하여 매도할 수 없습니다"
  - [ ] PUT validation: negative shares at any history point returns 400 with date
  - [ ] Unrealized P&L displayed correctly; null current_price shows "-" for price/value/pnl columns
  - [ ] Realized P&L computed correctly for all sell transactions
  - [ ] FX rate conversion works for foreign currency holdings; missing FX rate shows "-" in UI
  - [ ] Filters by account and family member work correctly
  - [ ] Weight is filter-relative (sums to 100% within filtered set)
  - [ ] 80%+ test coverage on HoldingService computation logic

## Do

- **Tasks**:
  - [ ] Wave 1: Foundation
    - [ ] Add `Transaction`, `CreateTransactionPayload`, `UpdateTransactionPayload`, `HoldingWithDetails`, `RealizedPnlEntry` to `src/shared/types.ts` — Low
    - [ ] Add `transactions` table to `src/server/database/schema.ts` with FK references, composite index, and `CHECK (type IN ('buy','sell'))` note — Low
    - [ ] Generate Drizzle migration (`npm run db:generate`) and verify SQL includes CHECK constraint — Low
    - [ ] Implement `TransactionRepository` with `findAll(filter)`, `findById()`, `create()`, `update()`, `delete()` — Medium

  - [ ] Wave 2: Server logic + API
    - [ ] Add `PriceHistoryRepository.findLatestByProductIds(ids: number[])` method — Low
    - [ ] Implement `HoldingService` — moving average algorithm, realized P&L accumulation, FX rate lookup, weight calculation — High
    - [ ] Write unit tests for `HoldingService` covering: canonical fixture, edge cases (sell-to-zero + rebuy, missing FX, null current_price) — Medium
    - [ ] Implement `POST /api/transactions` with sell validation (wrap in DB transaction) and `PUT /api/transactions/:id` with full-history recompute check — Medium
    - [ ] Implement `GET /api/transactions` (with query filters), `DELETE /api/transactions/:id`, `GET /api/holdings`, `GET /api/holdings/realized-pnl` — Medium
    - [ ] Register routes in `src/server/index.ts` — Low

  - [ ] Wave 3: Client hooks
    - [ ] Add `api.transactions` and `api.holdings` methods to client API layer — Low
    - [ ] Implement `useTransactions(filter)` TanStack Query hook — Low
    - [ ] Implement `useHoldings(filter)` and `useRealizedPnl(filter)` TanStack Query hooks — Low

  - [ ] Wave 4: UI
    - [ ] Add `/holdings` route (lazy-loaded `HoldingsPage`) to `routes/assets.ts` and `navigation.ts` — Low
    - [ ] Build `HoldingsPage` layout: filter bar (account selector, family member selector) — Low
    - [ ] Build `HoldingsTable` — columns: 종목명, 보유수량, 평균단가, 현재가, 평가금액, 손익(미실현), 수익률; null handling; loading skeleton — Medium
    - [ ] Build expandable holding row: inline `TransactionList` for the selected holding — Medium
    - [ ] Build `TransactionFormDialog` — buy/sell toggle, fields: shares/price/fee/tax/date/memo, date-change confirmation dialog on edit — Medium
    - [ ] Build `RealizedPnlSection` — collapsible panel with per-sell-transaction table and summary total — Medium

  - [ ] Wave 5: Verification
    - [ ] Run `npx tsc --noEmit` and resolve all type errors — Low
    - [ ] Run `npx vitest run` and confirm 80%+ coverage on HoldingService — Low
    - [ ] Manual E2E smoke test: create buy, sell, view holdings, edit transaction with date change, delete transaction — Low

- **Progress Log**:
  - 2026-03-14: PDCA plan created

## Check

- **Results**:
  - [Pending implementation]

- **Evidence**:
  - [Pending verification]

## Act

- **Learnings**:
  1. [Pending completion]

- **Next Actions**:
  1. [Pending completion]
