---
type: prd
prd-id: PRD-FEAT-017
prd-type: feature
title: Holdings Price Collection Scheduler (보유종목 가격 수집 스케줄러)
status: approved
implementation-status: not-started
created: 2026-03-14
updated: 2026-03-14
author: -
tags: [prd, scheduler, price, holdings, naver-finance, yahoo-finance, krx, nasdaq]
---

# Feature: Holdings Price Collection Scheduler (보유종목 가격 수집 스케줄러)

## 1. Overview

PRD-FEAT-005 (Price History Scheduler)는 카탈로그 내 전체 종목(1,806개)의 일별 OHLCV 가격을 매일 한 번 수집한다. 그러나 포트폴리오 평가 및 실시간 손익 계산에 필요한 것은 사용자가 **현재 보유 중인 종목**의 최신 가격이다. 전체 카탈로그 수집은 리소스 효율이 낮고, KRX 장중(09:00~16:00 KST)에는 가격 갱신이 이루어지지 않기 때문에 보유 포지션의 평가금액이 전일 종가 기준으로 고정된다.

이 기능은 `transactions` 테이블에서 순 보유 수량(`SUM(shares) > 0`)이 양수인 종목만 대상으로, **경량(lightweight) 가격 수집기**를 별도로 운영한다. 국내 종목(KRX/KOSPI/KOSDAQ)은 KRX 영업일 장중 매 시간 정각에 수집하고, 해외 종목(NYSE/NASDAQ/AMEX)은 미국 장 마감 후 매일 1회 수집한다. 기존 PRD-FEAT-005의 `NaverFinanceAdapter`, `YahooFinanceAdapter`, `exchange-routing.ts`를 그대로 재사용하여 중복 코드 없이 두 스케줄을 공존시킨다.

이 스케줄러는 PRD-FEAT-005를 대체하지 않는다. 양자는 서로 다른 목적을 가진다: PRD-FEAT-005는 전체 카탈로그의 장기 OHLCV 이력을 구축하는 데 사용되고, PRD-FEAT-017은 오늘 하루치(`startDate = endDate = today`) 가격만 빠르게 갱신하여 보유 포트폴리오의 평가금액을 최신 상태로 유지한다.

---

## 2. User Stories

- As a system, I want to collect today's closing price for all actively held domestic products every hour during KRX trading hours so that portfolio valuations reflect intraday price movements.
- As a system, I want to collect today's closing price for all actively held foreign products once daily after the US market closes so that foreign asset valuations are always based on the most recent session.
- As a developer, I want to manually trigger a holdings price collection run via API so that I can verify the pipeline without waiting for the scheduled time.
- As a developer, I want to monitor holdings price scheduler execution history so that I can quickly diagnose collection failures.
- As a user, I want my portfolio's current market value to reflect recent prices so that unrealized P&L is computed from current data, not yesterday's close.

---

## 3. Scope

### In Scope

- `ProductRepository.findWithActiveHoldings()` — new repository method that queries products where net transaction shares > 0
- `HoldingsPriceCollectorService` — new service with `run(scope: 'domestic' | 'foreign' | 'all')` and `running` getter; today-only date range (`startDate = endDate = today`); reuses existing `NaverFinanceAdapter`, `YahooFinanceAdapter`, `exchange-routing.ts`
- Domestic scheduler seed row: `holdings-price-domestic`, cron `0 0-7 * * 1-5` (UTC) = KST 09:00–16:00 on weekdays (16:00 intentionally included — captures confirmed closing price 30 minutes after 15:30 KRX close)
- Foreign scheduler seed row: `holdings-price-foreign`, cron `0 22 * * 1-5` (UTC) = KST 07:00 Tue–Sat
- `startSchedulers` extended with `holdingsPriceService` parameter; dispatch block handles `holdings-price-domestic` and `holdings-price-foreign` task names
- Execution logging via `TaskExecutionRepository` (existing); trim to 10 records per task
- API routes under `/api/scheduler/holdings-price`: `POST /run` (scope='all', 202/409) and `GET /status` (last 10 executions, combined from both tasks)
- Frontend: `HoldingsPriceSchedulerPage` (run button + execution history), `useHoldingsPriceScheduler` hook, nav item "보유종목 가격" in scheduler group, route in `routes/system.ts`
- Unit tests for `HoldingsPriceCollectorService` (80%+ coverage)

### Out of Scope

- Intraday real-time streaming or WebSocket push
- Pre/post market price collection
- Cryptocurrency holdings (UPBIT/BINANCE adapters)
- Portfolio-level aggregation or dashboard — handled by a separate analytics PRD
- Modification of the existing PRD-FEAT-005 daily full-catalog scheduler
- Multi-process / distributed scheduler coordination (single-process deployment is assumed)
- Non-KRX domestic exchanges (e.g., KONEX)
- Authentication or authorization for the manual trigger endpoint (internal-only)
- Dividend or corporate action adjustments
- Automatic disabling of cron during public holidays (market closures result in empty API responses, which are silently skipped)

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Identify active holdings | Given the `transactions` table has buy/sell records, when `ProductRepository.findWithActiveHoldings()` is called, then only products where `SUM(CASE WHEN type='buy' THEN shares ELSE -shares END) > 0` (grouped by `product_id`) are returned. Products with net zero or negative shares are excluded. |
| 2 | Domestic hourly collection | Given at least one actively held domestic product (exchange in {KRX, KOSPI, KOSDAQ}) exists, when the domestic cron fires at any hour 09:00–16:00 KST on a weekday, then `HoldingsPriceCollectorService.run('domestic')` is called; Naver Finance API is fetched for each product with `startDate = endDate = today`; results are upserted into `price_history`. |
| 3 | Foreign daily collection | Given at least one actively held foreign product (exchange in {NYSE, NASDAQ, AMEX}) exists, when the foreign cron fires at 07:00 KST on a weekday, then `HoldingsPriceCollectorService.run('foreign')` is called; Yahoo Finance API is fetched for each product with `startDate = endDate = today`; results are upserted into `price_history`. |
| 4 | Manual trigger (all scope) | Given the collector is idle, when `POST /api/scheduler/holdings-price/run` is called, then a collection run for scope='all' starts asynchronously and `202 Accepted` is returned with `{ run_id }` (the `task_executions.id`). If the collector is already running, `409 Conflict` is returned. The execution record is logged under the `holdings-price-domestic` task ID (no separate manual task row). |
| 5 | Scope filtering | Given `run('domestic')` is called, then only products whose exchange maps to `'naver'` via `resolveAdapter()` are processed; foreign products are skipped without error. Given `run('foreign')` is called, then only `'yahoo'`-mapped products are processed. Given `run('all')` is called, then all held products regardless of exchange are processed. |
| 6 | Today-only date range | Given any run scope, when the service fetches prices, then `startDate` and `endDate` are both set to the current calendar date (today). The lookback window from PRD-FEAT-005 (`PRICE_HISTORY_DEFAULT_LOOKBACK_DAYS`) is not used. |
| 7 | Upsert with no duplicates | Given `price_history` already has a row for `(product_id, today)`, when the holdings price collector runs again for the same product, then the existing row is updated (upserted) and no duplicate rows are created. |
| 8 | Execution logging | Given a run completes (success, partial, or failed), when `TaskExecutionRepository` records the result, then `started_at`, `finished_at`, `status`, `products_total`, `products_succeeded`, `products_failed`, `products_skipped`, and `message` are populated. Execution records are trimmed to the most recent 10 per task after each run. |
| 9 | Status endpoint | Given past executions exist for both `holdings-price-domestic` and `holdings-price-foreign` tasks, when `GET /api/scheduler/holdings-price/status` is called, then the last 10 combined execution records are returned sorted by `started_at` DESC. |
| 10 | No held products | Given no products have net positive shares, when the collector runs, then the run completes immediately with `products_total = 0`, `products_succeeded = 0`, `status = 'success'`, and a `202` is returned for manual runs. |
| 11 | Stale run recovery | Given the server restarts while a holdings price collection is in `'running'` state, when `startSchedulers` runs, then the stale execution row is marked `'failed'` with `message = 'Interrupted by server restart'` and `finished_at = now()`. |
| 12 | Frontend run and status | Given the user navigates to the 보유종목 가격 scheduler page, when the page loads, then the last execution status and a "수집 실행" button are displayed. When the user clicks the button and the collector is idle, then `POST /api/scheduler/holdings-price/run` is called and the status table refreshes. |

---

## 5. Technical Design

### Architecture

```
Cron: holdings-price-domestic (0 0-7 * * 1-5 UTC = KST 09:00-16:00 weekdays)
  → HoldingsPriceCollectorService.run('domestic')

Cron: holdings-price-foreign (0 22 * * 1-5 UTC = KST 07:00 Tue-Sat)
  → HoldingsPriceCollectorService.run('foreign')

POST /api/scheduler/holdings-price/run (manual)
  → HoldingsPriceCollectorService.run('all')

HoldingsPriceCollectorService
  ├─ ProductRepository.findWithActiveHoldings()   (new method)
  ├─ resolveAdapter(exchange)                      (existing, exchange-routing.ts)
  ├─ NaverFinanceAdapter                           (existing, reused)
  ├─ YahooFinanceAdapter                           (existing, reused)
  ├─ PriceHistoryRepository.upsert()              (existing)
  └─ TaskExecutionRepository.log/trim()           (existing)
```

### Database

No new tables are required. The feature reuses:

- `products` — source of product metadata (code, exchange)
- `transactions` — source for computing net active holdings
- `price_history` — destination for collected OHLCV rows (existing upsert method)
- `scheduled_tasks` — two new seed rows (see below)
- `task_executions` — execution log per run

New repository method on `ProductRepository`:

```typescript
// src/server/database/product-repository.ts
async findWithActiveHoldings(): Promise<readonly Product[]> {
  // SELECT DISTINCT p.* FROM products p
  // JOIN transactions t ON t.product_id = p.id
  // GROUP BY p.id
  // HAVING SUM(CASE WHEN t.type = 'buy' THEN t.shares ELSE -t.shares END) > 0
}
```

### Scheduler Seed Rows

Two rows inserted idempotently (`INSERT ON CONFLICT (name) DO NOTHING`) into `scheduled_tasks` on server startup:

| name | cron_expression | enabled | Notes |
|------|-----------------|---------|-------|
| `holdings-price-domestic` | `0 0-7 * * 1-5` | `true` | UTC 00:00–07:00 Mon–Fri = KST 09:00–16:00 weekdays |
| `holdings-price-foreign` | `0 22 * * 1-5` | `true` | UTC 22:00 Mon–Fri = KST 07:00 Tue–Sat |

### HoldingsPriceCollectorService

```typescript
// src/server/scheduler/holdings-price-collector-service.ts
type Scope = 'domestic' | 'foreign' | 'all'

export class HoldingsPriceCollectorService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceHistoryRepo: PriceHistoryRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly naverAdapter: NaverFinanceAdapter,
    private readonly yahooAdapter: YahooFinanceAdapter,
    private readonly domesticTaskId: number,
    private readonly foreignTaskId: number,
  ) {}

  get running(): boolean
  async run(scope: Scope): Promise<TaskExecution>
  private resolveTaskId(scope: Scope): number  // 'all' → domesticTaskId
  private filterByScope(products: readonly Product[], scope: Scope): readonly Product[]
  private collectProduct(product: Product, today: string): Promise<'success' | 'failed' | 'skipped'>
}
```

Key behaviors:
- `run(scope)` sets `startDate = endDate = today` (YYYY-MM-DD of the current local date)
- Products with `code = null` or unknown exchange are silently skipped (`products_skipped++`)
- Per-product errors are isolated — a single product failure does not abort the run
- The `running` flag prevents concurrent executions; `POST /run` returns 409 if set
- Execution record is created at run start with `status = 'running'`, then updated on completion

### startSchedulers Extension

```typescript
// src/server/scheduler/index.ts
export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  priceService: PriceCollectorService,
  etfService: EtfComponentCollectorService,
  exchangeRateService: ExchangeRateCollectorService,
  holdingsPriceService: HoldingsPriceCollectorService,  // NEW
): Promise<void>
```

Dispatch block addition:

```typescript
} else if (task.name === 'holdings-price-domestic') {
  await holdingsPriceService.run('domestic')
} else if (task.name === 'holdings-price-foreign') {
  await holdingsPriceService.run('foreign')
}
```

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `POST` | `/api/scheduler/holdings-price/run` | Manual trigger, scope='all' | `202 { success: true, data: { run_id: number } }` or `409` if running |
| `GET` | `/api/scheduler/holdings-price/status` | Last 10 executions (both tasks combined) | `200 ApiResponse<TaskExecution[]>` sorted by `started_at` DESC |

### Shared Types

No new types added to `src/shared/types.ts`. The existing `TaskExecution` type (from PRD-FEAT-005) covers the execution log. `Product` type is already defined.

### Frontend Components

- `HoldingsPriceSchedulerPage.tsx` — follows the existing `EtfSchedulerPage` / `ExchangeRateSchedulerPage` pattern: run button, last execution status badge, execution history table
- `useHoldingsPriceScheduler.ts` — hook wrapping `api.holdingsPriceScheduler.status()` and `api.holdingsPriceScheduler.run()`; polling interval 10 seconds while status is `'running'`
- `api.ts` addition — `holdingsPriceScheduler: { run, status }` API object
- `navigation.ts` — nav item "보유종목 가격" with appropriate icon in scheduler group
- `routes/system.ts` — route `/scheduler/holdings-price` → `HoldingsPriceSchedulerPage`

### File Structure

```
src/server/
  database/
    product-repository.ts                      # Add findWithActiveHoldings()
  scheduler/
    holdings-price-collector-service.ts        # New
    index.ts                                   # Extend startSchedulers
  routes/
    holdings-price-scheduler.ts                # New (POST /run, GET /status)
  index.ts                                     # Wire new service + routes
src/client/src/
  lib/api.ts                                   # Add holdingsPriceScheduler API
  features/scheduler/
    use-holdings-price-scheduler.ts            # New hook
    HoldingsPriceSchedulerPage.tsx             # New page
  navigation.ts                                # Add nav item
  routes/system.ts                             # Add route
tests/unit/
  holdings-price-collector-service.test.ts     # New
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Add `findWithActiveHoldings()` method to `ProductRepository` — unit test (RED) for net-share computation with mixed buy/sell transactions, then implement using Drizzle SQL raw expression (GREEN); TypeScript compile check | Low |
| 2 | Implement `HoldingsPriceCollectorService` — unit tests (RED) covering: scope filtering (domestic/foreign/all), today-only date range, `running` flag, 409 on concurrent call, products_skipped for null code, isolated per-product failure (GREEN) | Medium |
| 3 | Server wiring: seed two `scheduled_tasks` rows (idempotent) in `startSchedulers`, extend `startSchedulers` signature with `holdingsPriceService`, add dispatch branches for `holdings-price-domestic` and `holdings-price-foreign`, wire service and taskIds in `src/server/index.ts` | Low |
| 4 | Hono route (`holdings-price-scheduler.ts`): `POST /run`, `GET /status`; mount at `/api/scheduler/holdings-price` in `src/server/index.ts` | Low |
| 5 | Frontend: `useHoldingsPriceScheduler` hook + `HoldingsPriceSchedulerPage` component + `api.ts` additions + `navigation.ts` nav item + `routes/system.ts` route | Medium |
| 6 | End-to-end smoke test: start server locally, call `POST /api/scheduler/holdings-price/run`, verify `202`, poll `GET /status` until `status = 'success'`, confirm `price_history` rows updated for held products | Low |

Note: All waves follow mandatory TDD order — RED (failing tests) → GREEN (implement) → REFACTOR. Each wave commits independently.

---

## 7. Success Metrics

- [ ] `ProductRepository.findWithActiveHoldings()` returns only products with net positive shares — verified by unit tests covering buy-only, buy+sell to zero, and buy+partial-sell cases
- [ ] `HoldingsPriceCollectorService.run('domestic')` processes only KRX/KOSPI/KOSDAQ products; `run('foreign')` processes only NYSE/NASDAQ/AMEX products; `run('all')` processes all held products — verified by unit tests
- [ ] `startDate` and `endDate` passed to adapters are both equal to today's date — verified by unit test spy on adapter calls
- [ ] `price_history` upsert is called for each held product; no duplicate rows after repeated runs — verified by unique constraint on `(product_id, date)` and unit test assertions
- [ ] `POST /api/scheduler/holdings-price/run` returns `202` when idle and `409` when already running
- [ ] `GET /api/scheduler/holdings-price/status` returns last 10 execution records sorted by `started_at` DESC, combining both domestic and foreign task executions
- [ ] `task_executions` retains at most 10 rows per task after each run
- [ ] Stale `'running'` execution rows are marked `'failed'` on server restart (inherited from existing `recoverStaleRuns` logic)
- [ ] No products are processed when `findWithActiveHoldings()` returns an empty list; run completes with `products_total = 0` and `status = 'success'`
- [ ] Unit tests achieve 80%+ coverage (statements, branches, functions, lines) for `holdings-price-collector-service.ts` and the new `product-repository` method
- [ ] TypeScript compiles with zero errors after all changes (`npx tsc --noEmit`)
- [ ] Frontend scheduler page renders the last execution status and allows manual run trigger; nav item "보유종목 가격" appears in the scheduler group

---

## 8. Dependencies

- PRD-FEAT-005 (Price History Scheduler) — `price_history` table, `PriceHistoryRepository` (upsert method), `NaverFinanceAdapter`, `YahooFinanceAdapter`, `exchange-routing.ts`, `withRetry`, `TaskExecutionRepository`, `ScheduledTaskRepository`, `startSchedulers` function are all directly reused
- PRD-FEAT-014 (Holdings Management) — `transactions` table with `type ('buy'|'sell')` and `shares` columns is the source for computing active holdings; this PRD must be merged first (or the table must exist with the expected schema)
- PRD-FEAT-016 (Exchange Rate Scheduler) — `startSchedulers` signature extension pattern is followed; the parameter list is additive and this PRD appends `holdingsPriceService` as the next parameter
- PRD-FEAT-012 (ETF Component Scheduler) — `EtfComponentCollectorService` is the structural reference for `HoldingsPriceCollectorService`; no runtime dependency
- `node-cron` — already present in project; no new dependency
- `yahoo-finance2` — already present; no new dependency
- Naver Finance API — unofficial public endpoint; already used by PRD-FEAT-005; same rate-limit constraints apply
- No new environment variables required

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `transactions` table schema differs from expected (missing `type` or `shares` columns) | High | Implement `findWithActiveHoldings()` only after PRD-FEAT-014 is merged and schema is confirmed; add compile-time Drizzle type checks |
| Naver Finance API rate limiting during hourly domestic runs | Medium | Holdings scope is typically small (< 50 products); existing per-batch delay from `NaverFinanceAdapter` applies; exponential backoff via `withRetry` handles transient failures |
| Yahoo Finance rate limiting or IP bans for foreign holdings | Medium | Foreign run is once daily; existing batch delay and `withRetry` apply; small holdings set reduces request volume significantly |
| `startSchedulers` signature chain grows too long as each PRD adds a parameter | Low | Current count will be 6 parameters after this PRD; acceptable for single-process app; consider refactoring to a services object map in a future cleanup PRD |
| Domestic cron fires outside KRX market hours (public holidays, pre/post market) | Low | Naver Finance returns empty array for non-trading days; adapter treats empty response as success with 0 rows; no data corruption |
| `running` flag not shared across service instances if server is restarted mid-run | Low | Single-process deployment assumption; stale run recovery on startup (existing `recoverStaleRuns`) marks interrupted executions as `'failed'` |
| Holdings set changes between hourly runs (user adds/removes a transaction) | Low | `findWithActiveHoldings()` is called fresh at the start of each run; no caching; reflects latest state |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-14 | 1.0 | - | Initial PRD for holdings price collection scheduler, derived from design spec at docs/superpowers/specs/2026-03-14-holdings-price-scheduler-design.md |
| 2026-03-14 | 1.1 | - | Fix HIGH: run('all') logs to domesticTaskId, clarify 16:00 KST cron intentional (post-close capture). Status → approved |
