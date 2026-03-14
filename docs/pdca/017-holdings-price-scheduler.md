---
type: pdca-plan
plan-name: Holdings Price Collection Scheduler
related-prd: PRD-FEAT-017
phase: plan
status: not-started
created: 2026-03-14
updated: 2026-03-14
tags: [pdca, scheduler, price, holdings, naver-finance, yahoo-finance, krx, nasdaq]
---

# PDCA Plan: Holdings Price Collection Scheduler

## Plan

- **Goal**: Implement a lightweight price collection scheduler that refreshes today's prices for only actively-held products — domestic (KRX/KOSPI/KOSDAQ) hourly during market hours and foreign (NYSE/NASDAQ/AMEX) once daily after US market close — by reusing existing adapters and exposing REST endpoints and a frontend scheduler page.

- **Scope**:
  - Wave 1: `ProductRepository.findWithActiveHoldings()` — new repository method (TDD)
  - Wave 2: `HoldingsPriceCollectorService` — service class with `run(scope)` and `running` getter (TDD)
  - Wave 3: Server wiring — seed rows, `startSchedulers` extension, `index.ts` wiring, Hono routes
  - Wave 4: Frontend — `useHoldingsPriceScheduler` hook + `HoldingsPriceSchedulerPage` + `api.ts` + nav + route
  - Wave 5: Verification — typecheck, unit test coverage ≥ 80%, end-to-end smoke test

- **Success Metrics**:
  - [ ] `ProductRepository.findWithActiveHoldings()` returns only products with net positive shares — verified by unit tests covering buy-only, buy+sell-to-zero, and buy+partial-sell cases
  - [ ] `HoldingsPriceCollectorService.run('domestic')` processes only KRX/KOSPI/KOSDAQ products; `run('foreign')` processes only NYSE/NASDAQ/AMEX products; `run('all')` processes all held products — verified by unit tests
  - [ ] `startDate` and `endDate` passed to adapters are both equal to today's date — verified by unit test spy on adapter calls
  - [ ] `price_history` upsert is called for each held product; no duplicate rows after repeated runs — verified by unit test assertions
  - [ ] `POST /api/scheduler/holdings-price/run` returns `202` when idle and `409` when already running
  - [ ] `GET /api/scheduler/holdings-price/status` returns last 10 combined execution records sorted by `started_at` DESC
  - [ ] `task_executions` retains at most 10 rows per task after each run
  - [ ] Stale `'running'` execution rows are marked `'failed'` on server restart (inherited from existing `recoverStaleRuns` logic)
  - [ ] No products processed when `findWithActiveHoldings()` returns empty list; run completes with `products_total = 0` and `status = 'success'`
  - [ ] Unit tests achieve 80%+ coverage for `holdings-price-collector-service.ts` and the new `findWithActiveHoldings()` method
  - [ ] TypeScript compiles with zero errors after all changes (`npx tsc --noEmit`)
  - [ ] Frontend scheduler page renders last execution status and allows manual run trigger; nav item "보유종목 가격" appears in scheduler group

## Do

- **Tasks**:

  ### Wave 1 — Repository: findWithActiveHoldings (TDD)
  - [ ] Write RED unit tests for `ProductRepository.findWithActiveHoldings()`: buy-only products returned, net-zero (buy+sell equal) excluded, partial-sell (buy > sell) returned, empty transactions returns empty list — Low
  - [ ] Implement `findWithActiveHoldings()` in `src/server/database/product-repository.ts` using Drizzle SQL raw expression (`SUM(CASE WHEN type='buy' THEN shares ELSE -shares END) > 0`) to pass tests (GREEN) — Low
  - [ ] Run `npx tsc --noEmit` to verify no compilation errors — Low

  ### Wave 2 — HoldingsPriceCollectorService (TDD)
  - [ ] Write RED unit tests for `HoldingsPriceCollectorService`: scope filtering (domestic/foreign/all), today-only date range verified via adapter spy, `running` getter reflects in-flight state, 409 behavior when `running=true`, products_skipped for null `code`, isolated per-product failure does not abort run, empty holdings completes with `products_total=0` and `status='success'` — Medium
  - [ ] Implement `HoldingsPriceCollectorService` in `src/server/scheduler/holdings-price-collector-service.ts` with constructor accepting `productRepo`, `priceHistoryRepo`, `taskExecutionRepo`, `naverAdapter`, `yahooAdapter`, `domesticTaskId`, `foreignTaskId`; private methods `resolveTaskId`, `filterByScope`, `collectProduct` (GREEN) — Medium
  - [ ] Run `npx tsc --noEmit` to verify compilation — Low

  ### Wave 3 — Server Wiring + Hono Routes
  - [ ] Seed two `scheduled_tasks` rows idempotently in `src/server/scheduler/index.ts` (`holdings-price-domestic` cron `0 0-7 * * 1-5`, `holdings-price-foreign` cron `0 22 * * 1-5`) — Low
  - [ ] Extend `startSchedulers` signature with `holdingsPriceService: HoldingsPriceCollectorService` parameter and add dispatch branches for `holdings-price-domestic` and `holdings-price-foreign` — Low
  - [ ] Implement Hono route file `src/server/routes/holdings-price-scheduler.ts`: `POST /run` (scope='all', 202/409 with `run_id`), `GET /status` (last 10 combined executions sorted by `started_at` DESC) — Low
  - [ ] Wire `src/server/index.ts`: construct `HoldingsPriceCollectorService` with correct taskIds, pass to `startSchedulers`, register route at `/api/scheduler/holdings-price` — Low
  - [ ] Run `npx tsc --noEmit` to verify full compilation — Low

  ### Wave 4 — Frontend
  - [ ] Add `holdingsPriceScheduler: { run, status }` API object to `src/client/src/lib/api.ts` — Low
  - [ ] Implement `useHoldingsPriceScheduler` hook in `src/client/src/features/scheduler/use-holdings-price-scheduler.ts`: status polling (10s interval when status is `'running'`), run trigger — Low
  - [ ] Implement `HoldingsPriceSchedulerPage` in `src/client/src/features/scheduler/HoldingsPriceSchedulerPage.tsx`: run button ("수집 실행"), last-execution status badge, execution history table (follows `EtfSchedulerPage` / `ExchangeRateSchedulerPage` pattern) — Medium
  - [ ] Add nav item "보유종목 가격" to scheduler group in `src/client/src/navigation.ts` — Low
  - [ ] Add route `/scheduler/holdings-price` → `HoldingsPriceSchedulerPage` in `src/client/src/routes/system.ts` — Low

  ### Wave 5 — Verification
  - [ ] Run `npx vitest run --coverage` and confirm ≥ 80% coverage for `holdings-price-collector-service.ts` and the `findWithActiveHoldings` method — Low
  - [ ] End-to-end smoke test: start server, call `POST /api/scheduler/holdings-price/run`, verify `202` and `run_id`, poll `GET /status` until `status = 'success'`, confirm `price_history` rows updated for held products — Low
  - [ ] Final `npx tsc --noEmit` clean pass — Low

- **Progress Log**:
  - 2026-03-14: PDCA plan created. Implementation not started.

## Check

- **Results**:
  - [Not yet run]

- **Evidence**:
  - [Not yet collected]

## Act

- **Learnings**:
  1. [To be filled after completion]

- **Next Actions**:
  1. [To be filled after completion]
