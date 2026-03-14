---
type: pdca-plan
plan-name: Exchange Rate Collection Scheduler
related-prd: PRD-FEAT-016
phase: do
status: in-progress
created: 2026-03-14
updated: 2026-03-14
tags: [pdca, scheduler, exchange-rate, exim, naver, usd, krw]
---

# PDCA Plan: Exchange Rate Collection Scheduler

## Plan

- **Goal**: Implement a USD/KRW exchange rate collection scheduler that fetches rates via a 3-tier fallback chain (EXIM Bank API → Naver Finance scraping → constant 1350), stores results in a dedicated `exchange_rates` table, exposes REST endpoints for data and manual trigger, and refactors `HoldingService.fetchFxRates()` to use the new table as a single source of truth.

- **Scope**:
  - Wave 1: Drizzle schema (`exchange_rates` table) + migration + shared type (`ExchangeRate`) in `src/shared/types.ts`
  - Wave 2: `ExchangeRateRepository` (TDD) — `findAll`, `findByCurrency`, `upsert`, `getRate`
  - Wave 3: `ExchangeRateFetcher` (TDD) — EXIM tier, Naver scraping tier, constant fallback tier
  - Wave 4: `ExchangeRateCollectorService` (TDD) — `run()`, `running` getter, execution logging, trim 10 records
  - Wave 5: Hono routes (`exchange-rates.ts` data routes + `exchange-rate-scheduler.ts` scheduler routes) + `startSchedulers` signature extension + seed row + server `index.ts` wiring
  - Wave 6: `HoldingService.fetchFxRates()` refactor — replace `price_history` FX lookup with `ExchangeRateRepository.getRate('USD')`
  - Wave 7: Frontend — `useExchangeRateScheduler` hook + `ExchangeRateSchedulerPage` component + `api.ts` additions + `navigation.ts` nav item + `routes/system.ts` route

- **Success Metrics**:
  - [ ] `exchange_rates` table has a `USD` row after first scheduler run or `POST /api/exchange-rates/update` call
  - [ ] `ExchangeRateFetcher` tries EXIM first (when `EXIM_API_KEY` is set), falls back to Naver, then falls back to 1350 — verified by unit tests with mocked HTTP
  - [ ] Constant fallback (1350) results in `task_executions.status = 'completed'`, not `failed`
  - [ ] `upsert` replaces the existing `USD` row on subsequent runs (single-row semantics, no duplicates)
  - [ ] `HoldingService.fetchFxRates()` reads from `exchange_rates` table, not `price_history` — verified by updated unit tests
  - [ ] `POST /api/scheduler/exchange-rate/run` returns `202` when idle, `409` when already running
  - [ ] `GET /api/scheduler/exchange-rate/status` returns last 10 execution records sorted by `started_at` DESC
  - [ ] `GET /api/exchange-rates/USD` returns the current rate; `GET /api/exchange-rates/EUR` returns `404`
  - [ ] `task_executions` retains at most 10 rows per task after each run
  - [ ] Unit tests achieve 80%+ coverage for `exchange-rate-fetcher.ts` and `exchange-rate-collector-service.ts`
  - [ ] TypeScript compiles with zero errors after all changes (`npx tsc --noEmit`)
  - [ ] Frontend scheduler page renders last execution status and allows manual run trigger

## Do

- **Tasks**:

  ### Wave 1 — Foundation: Schema + Types
  - [ ] Add `exchangeRates` table to `src/server/database/schema.ts` with `id`, `currency` (unique), `rate` (numeric 18,4), `updated_at` columns — Low
  - [ ] Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`) — Low
  - [ ] Add `ExchangeRate` interface to `src/shared/types.ts` — Low
  - [ ] Run `npx tsc --noEmit` to verify no compilation errors — Low

  ### Wave 2 — Repository Layer (TDD)
  - [ ] Write RED tests for `ExchangeRateRepository`: `findAll` (returns all rows), `findByCurrency` (returns row or undefined), `upsert` (insert + update single-row semantics), `getRate` (returns 1.0 default when not found) — Low
  - [ ] Implement `ExchangeRateRepository` in `src/server/database/exchange-rate-repository.ts` to pass tests (GREEN) — Low

  ### Wave 3 — ExchangeRateFetcher (TDD)
  - [ ] Write RED tests for `ExchangeRateFetcher`: EXIM tier parses JSON response when `EXIM_API_KEY` set, falls through to Naver on EXIM failure, falls through to constant 1350 when both fail, `fetchUsdRate` returns number, `updateUsdRate` calls upsert — Medium
  - [ ] Implement `ExchangeRateFetcher` in `src/server/services/exchange-rate-fetcher.ts` with `fetchFromExim` (private), `fetchFromNaver` (private, cheerio HTML scraping), constant fallback `FALLBACK_USD_KRW = 1350`, `fetchUsdRate()`, `updateUsdRate()` (GREEN) — Medium

  ### Wave 4 — ExchangeRateCollectorService (TDD)
  - [ ] Write RED tests for `ExchangeRateCollectorService`: `run()` creates execution record, fetches rate, upserts row, logs `products_total = 1` and `products_succeeded = 1`, trims executions to 10, `running` getter reflects in-flight state — Low
  - [ ] Implement `ExchangeRateCollectorService` in `src/server/scheduler/exchange-rate-collector-service.ts` to pass tests (GREEN) — Low

  ### Wave 5 — Integration + API Routes
  - [ ] Implement Hono data routes `src/server/routes/exchange-rates.ts`: `GET /` (all rates), `GET /:currency` (single, 404 when not found), `POST /update` (fresh fetch + upsert, returns updated row) — Low
  - [ ] Implement Hono scheduler routes `src/server/routes/exchange-rate-scheduler.ts`: `POST /run` (202 idle / 409 busy), `GET /status` (last 10 records DESC) — Low
  - [ ] Extend `startSchedulers` in `src/server/scheduler/index.ts`: add `exchangeRateService` parameter and dispatch block for `exchange-rate-collection-daily` — Medium
  - [ ] Wire `src/server/index.ts`: seed `exchange-rate-collection-daily` row (`enabled: true`), query taskId, construct `ExchangeRateCollectorService`, pass to `startSchedulers`, register new routes — Medium
  - [ ] Run `npx tsc --noEmit` to verify full compilation — Low

  ### Wave 6 — HoldingService Refactor
  - [ ] Refactor `HoldingService.fetchFxRates()` in `src/server/services/holding-service.ts`: replace `price_history` FX query with `ExchangeRateRepository.getRate('USD')`, return `{ KRW: 1.0, USD: usdRate }` — Low
  - [ ] Update existing `HoldingService` unit tests to assert that `fetchFxRates()` uses `ExchangeRateRepository` (not `price_history`) — Low

  ### Wave 7 — Frontend
  - [ ] Add `exchangeRate` and `exchangeRateScheduler` API objects to `src/client/src/lib/api.ts` — Low
  - [ ] Implement `useExchangeRateScheduler` hook in `src/client/src/features/scheduler/use-exchange-rate-scheduler.ts`: status polling, run trigger — Low
  - [ ] Implement `ExchangeRateSchedulerPage` in `src/client/src/features/scheduler/ExchangeRateSchedulerPage.tsx`: run button, last-execution status badge, execution history table (follows `EtfSchedulerPage` pattern) — Medium
  - [ ] Add nav item "환율수집" with Timer icon to scheduler group in `src/client/src/navigation.ts` — Low
  - [ ] Add route for `ExchangeRateSchedulerPage` in `src/client/src/routes/system.ts` — Low

- **Progress Log**:
  - 2026-03-14: PDCA plan created. Implementation not started.
  - 2026-03-14: Transitioned to Do phase. Implementation starting.

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
