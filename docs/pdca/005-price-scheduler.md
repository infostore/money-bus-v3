---
type: pdca-plan
plan-name: Price History Scheduler
related-prd: PRD-FEAT-005
phase: act
status: completed
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, scheduler, price, naver-finance, yahoo-finance, batch]
---

# PDCA Plan: Price History Scheduler

## Plan

- **Goal**: Implement an automated backend scheduler that collects daily OHLCV price data from Naver Finance (domestic) and Yahoo Finance (foreign) for all products with a known code, stores results in PostgreSQL via Drizzle ORM, and exposes manual trigger and status APIs.

- **Scope**:
  - Wave 1: Drizzle schema additions (`price_history`, `scheduled_tasks`, `task_executions`) + migration + shared types
  - Wave 2: `PriceHistoryRepository` — upsert rows, query last-collected date per product
  - Wave 3: `ScheduledTaskRepository` + `TaskExecutionRepository` — task definitions, execution logging with 10-record retention trim
  - Wave 4: `withRetry` utility + `exchange-routing` — retry logic and adapter dispatch map
  - Wave 5: `NaverFinanceAdapter` — domestic OHLCV, batch of 20, 1-second inter-batch delay
  - Wave 6: `YahooFinanceAdapter` — foreign OHLCV via `yahoo-finance2`, batch of 10, 2-second inter-batch delay
  - Wave 7: `PriceCollectorService` — orchestration: routing, incremental date range, batch processing, execution logging
  - Wave 8: Scheduler entry (`startSchedulers`), server integration, Hono routes for `/api/scheduler/*`

- **Success Metrics**:
  - [ ] `price_history` table receives OHLCV rows for all products with a non-null code and known exchange after one full scheduler run
  - [ ] No duplicate rows: upsert on `(product_id, date)` unique constraint prevents duplicates
  - [ ] Incremental mode: re-running scheduler the next day fetches only the new day's data
  - [ ] Domestic batch: Naver API called with groups of ≤ 20 products, ≥ 1-second delay between groups
  - [ ] Foreign batch: Yahoo Finance called with groups of ≤ 10 products, ≥ 2-second delay between groups
  - [ ] `withRetry` retries exactly 2 times on transient failure before marking product as failed
  - [ ] Per-product failure does not abort the full run; remaining products continue
  - [ ] `task_executions` table retains at most 10 rows per task after each run
  - [ ] `GET /api/scheduler/price-collection/status` returns last 10 execution records sorted by `started_at` DESC
  - [ ] `POST /api/scheduler/price-collection/run` returns `202` on success, `409` when already running
  - [ ] Products with `code = null` are silently skipped and counted in `products_skipped`
  - [ ] Products with unknown exchange are silently skipped with a `warn` log and counted in `products_skipped`
  - [ ] Tests achieve 80%+ coverage for scheduler module
  - [ ] Daily scheduler cron expression matches `0 11 * * *` (UTC) and is read from the `scheduled_tasks` DB row

## Do

- **Tasks**:

  ### Wave 1 — Foundation: Schema + Types
  - [ ] Add `price_history`, `scheduled_tasks`, `task_executions` tables to `src/server/database/schema.ts` — Low
  - [ ] Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`) — Low
  - [ ] Add shared types (`PriceHistory`, `ScheduledTask`, `TaskExecution`) to `src/shared/types.ts` — Low

  ### Wave 2 — PriceHistoryRepository (TDD)
  - [ ] Write RED tests for `PriceHistoryRepository`: upsert rows, query last-collected date, handle conflicts — Medium
  - [ ] Implement `PriceHistoryRepository` to pass tests (GREEN) — Medium

  ### Wave 3 — ScheduledTask + TaskExecution Repositories (TDD)
  - [ ] Write RED tests for `ScheduledTaskRepository`: seed default, findEnabled, upsert on conflict — Low
  - [ ] Write RED tests for `TaskExecutionRepository`: insert, trim to 10 records, recoverStaleRuns — Low
  - [ ] Implement both repositories to pass tests (GREEN) — Low

  ### Wave 4 — Utilities (TDD)
  - [ ] Write RED tests for `withRetry`: retry count, exponential backoff timing, error propagation — Low
  - [ ] Implement `withRetry` utility in `src/server/scheduler/with-retry.ts` (GREEN) — Low
  - [ ] Write RED tests for `resolveAdapter`: domestic exchanges → naver, foreign → yahoo, unknown → unknown — Low
  - [ ] Implement `exchange-routing.ts` (GREEN) — Low

  ### Wave 5 — NaverFinanceAdapter (TDD)
  - [ ] Create response fixture at `tests/fixtures/naver-sise-response.json` — Low
  - [ ] Write RED integration tests for `NaverFinanceAdapter`: parse fixture, batch grouping, delay enforcement, empty response handling — Medium
  - [ ] Implement `NaverFinanceAdapter` in `src/server/scheduler/naver-finance-adapter.ts` (GREEN) — Medium

  ### Wave 6 — YahooFinanceAdapter (TDD)
  - [ ] Write RED integration tests for `YahooFinanceAdapter`: mock `yahoo-finance2`, batch grouping, delay enforcement — Medium
  - [ ] Implement `YahooFinanceAdapter` in `src/server/scheduler/yahoo-finance-adapter.ts` (GREEN) — Medium

  ### Wave 7 — PriceCollectorService (TDD)
  - [ ] Write RED service tests: routing dispatch, incremental date range calculation, batch orchestration, execution logging, per-product failure isolation — High
  - [ ] Implement `PriceCollectorService` in `src/server/scheduler/price-collector-service.ts` (GREEN) — High

  ### Wave 8 — Integration + API
  - [ ] Implement `startSchedulers()` in `src/server/scheduler/index.ts` — Low
  - [ ] Install npm packages: `node-cron`, `yahoo-finance2` — Low
  - [ ] Integrate scheduler startup into `src/server/index.ts` (seed task row, recover stale runs, register cron) — Low
  - [ ] Implement Hono routes in `src/server/routes/scheduler.ts`: `POST /run` (202/409), `GET /status` — Low
  - [ ] Register scheduler routes in `src/server/index.ts` — Low

- **Progress Log**:
  - 2026-03-13: PDCA plan created. Implementation not started.
  - 2026-03-13: Phase transition plan → do. Implementation starting.
  - 2026-03-13: All 8 waves implemented. 222 tests passing. Phase transition do → check.
  - 2026-03-13: Verification passed. Coverage 87%+, typecheck clean. Phase transition check → act. PDCA completed.

## Check

- **Results**:
  - All 222 tests pass (16 test files)
  - Coverage: 87% stmts, 85% branches, 93% functions, 87% lines (all > 80%)
  - TypeScript: clean on both tsconfig.json and tsconfig.server.json
  - Scheduler module coverage: exchange-routing 100%, with-retry 100%, naver-adapter 97%, yahoo-adapter 100%, collector-service 98%

- **Evidence**:
  - `npx vitest run --coverage` — 222/222 tests pass, all coverage metrics above 80%
  - `npx tsc --noEmit` — no errors on both server and client configs

## Act

- **Learnings**:
  1. DI-based adapter design (injected fetchFn/client) enabled fast unit tests without network calls
  2. Parallel agent execution for independent waves (2+3, 5+6) reduced total implementation time significantly
  3. Naver Finance returns non-standard JSON (single quotes, trailing commas) requiring sanitization — fixture-based testing caught edge cases early

- **Next Actions**:
  1. Hourly holding-based collection mode (deferred to future PRD when `holdings` table exists)
  2. Admin UI for scheduler status and manual trigger (separate feature PRD)
  3. Cryptocurrency adapter (UPBIT/BINANCE) — out of scope for this PRD
