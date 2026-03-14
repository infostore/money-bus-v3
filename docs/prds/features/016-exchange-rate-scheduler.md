---
type: prd
prd-id: PRD-FEAT-016
prd-type: feature
title: Exchange Rate Collection Scheduler (환율 수집 스케줄러)
status: approved
implementation-status: not-started
created: 2026-03-14
updated: 2026-03-14
author: -
tags: [prd, scheduler, exchange-rate, exim, naver, usd, krw]
---

# Feature: Exchange Rate Collection Scheduler (환율 수집 스케줄러)

## 1. Overview

현재 보유 종목의 포트폴리오 평가 시 `HoldingService.fetchFxRates()`는 `price_history` 테이블에서 `FX:USDKRW` 심볼을 가진 가격 레코드를 조회하는 방식으로 USD/KRW 환율을 가져온다. 이 방식은 가격 수집 스케줄러(PRD-FEAT-005)가 FX 심볼을 지원하는 경우에만 동작하며, 환율 데이터의 출처와 갱신 주기가 불명확하다. 환율 데이터 없이는 달러 표시 자산(NASDAQ, NYSE 등 해외 종목)의 원화 환산 평가금액 계산이 불가능하다.

이 기능은 USD/KRW 환율을 전용 `exchange_rates` 테이블에 저장하고, 3단계 소스 폴백 체인(EXIM Bank API → Naver Finance 스크래핑 → 상수 폴백 1350)으로 매일 자동 수집하는 스케줄러를 구현한다. EXIM Bank API는 `EXIM_API_KEY` 환경변수가 설정된 경우 우선 사용되며, API 키가 없거나 요청이 실패하면 Naver Finance 페이지 스크래핑을 시도한다. Naver 스크래핑도 실패하면 상수값 1350을 사용한다. 이 구조는 money-bus-v1의 검증된 패턴을 v3 인프라(Drizzle ORM, PostgreSQL, node-cron, 기존 스케줄러 프레임워크)에 이식한 것이다.

`HoldingService`의 `fetchFxRates()` 메서드는 `price_history` 테이블 조회 방식에서 `exchange_rates` 테이블 직접 조회 방식으로 전환되어 환율 데이터의 단일 출처(Single Source of Truth)를 확립한다. 결과적으로 포트폴리오 평가 정확도가 개선되고, 환율 수집 실패 시 즉각적인 피드백(집행 이력, 상수 폴백)을 통해 서비스 안정성이 높아진다.

---

## 2. User Stories

- As a system, I want to automatically collect the USD/KRW exchange rate daily so that portfolio valuations using foreign-currency assets are always based on a recent rate.
- As a system, I want a 3-tier fallback (EXIM API → Naver scraping → constant 1350) so that the exchange rate is always available even when external sources are unavailable.
- As a developer, I want to manually trigger an exchange rate fetch via API so that I can verify the pipeline works without waiting for the cron schedule.
- As a developer, I want to query the current USD/KRW rate via a dedicated REST endpoint so that any future service can retrieve the rate without coupling to `price_history` structure.
- As a system, I want `HoldingService.fetchFxRates()` to read from `exchange_rates` directly so that there is a single authoritative source for all FX rate lookups.

---

## 3. Scope

### In Scope

- `exchange_rates` table (Drizzle schema + migration): stores one row per currency (`USD`), with `rate` (NUMERIC 18,4) and `updated_at`
- `ExchangeRateRepository`: `findAll()`, `findByCurrency(currency)`, `upsert(currency, rate)`, `getRate(currency)` — Drizzle ORM, PostgreSQL
- `ExchangeRateFetcher`: 3-tier fetch chain — EXIM Bank API (if `EXIM_API_KEY` set), Naver Finance scraping, constant fallback (1350)
- `ExchangeRateCollectorService`: follows existing `PriceCollectorService` / `EtfComponentCollectorService` pattern — `run()`, `running` getter, execution logging via `TaskExecutionRepository`, trim to 10 records
- Daily scheduler: cron `0 10 * * *` (UTC 10:00 = KST 19:00), after Korean market close, before price collection (UTC 20:00)
- Scheduler seed row: `{ name: 'exchange-rate-collection-daily', cron_expression: '0 10 * * *', enabled: true }` — enabled from day 1 (fallback constant guarantees a value even if all sources fail)
- `startSchedulers` extended with `exchangeRateService` parameter; dispatch block updated for `exchange-rate-collection-daily`
- `HoldingService.fetchFxRates()` refactored to use `ExchangeRateRepository.getRate('USD')` instead of `price_history` lookup
- Data API routes (`/api/exchange-rates`): `GET /`, `GET /:currency`, `POST /update`
- Scheduler API routes (`/api/scheduler/exchange-rate`): `POST /run`, `GET /status`
- Shared type: `ExchangeRate` interface added to `src/shared/types.ts`
- Frontend: `ExchangeRateSchedulerPage` (follows `EtfSchedulerPage` pattern), `useExchangeRateScheduler` hook, nav item "환율수집" in scheduler group, route in `routes/system.ts`
- Unit tests: `exchange-rate-fetcher.test.ts`, `exchange-rate-collector-service.test.ts` (80%+ coverage)
- Environment variable: `EXIM_API_KEY` (optional) — Korean EXIM Bank API key

### Out of Scope

- Multi-currency support beyond USD/KRW (EUR, JPY, etc.) — schema is designed to accommodate future currencies, but only USD is collected
- Historical exchange rate storage — only the latest rate per currency is stored (single-row upsert); no time series
- Rate change alerts or notification webhooks
- UI for historical rate charts or trend analysis
- Authentication/authorization for trigger API (internal-only endpoint)
- Intraday exchange rate updates (daily granularity is sufficient for portfolio valuation)
- Samsung KODEX or ETF component collection integration — handled by PRD-FEAT-012

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Fetch rate from EXIM API | Given `EXIM_API_KEY` is set and the EXIM endpoint returns valid data, when `ExchangeRateFetcher.fetchUsdRate()` is called, then the USD/KRW rate is parsed from the JSON response and returned as a number. Given the EXIM response contains no matching entry or returns an error status, then the fetcher proceeds to tier 2 (Naver). |
| 2 | Fetch rate from Naver Finance | Given `EXIM_API_KEY` is not set OR EXIM failed, when the Naver Finance exchange detail page is fetched, then the current USD/KRW rate is scraped from the page HTML and returned. Given the Naver page is unreachable or parsing fails, then the fetcher proceeds to tier 3 (fallback constant). |
| 3 | Fallback to constant rate | Given both EXIM and Naver sources fail or are unavailable, when `fetchUsdRate()` is called, then `FALLBACK_USD_KRW = 1350` is returned and a `warn`-level log entry is emitted indicating the fallback was used. |
| 4 | Upsert rate in exchange_rates | Given a USD/KRW rate has been fetched, when `ExchangeRateRepository.upsert('USD', rate)` is called, then the `exchange_rates` row for `currency = 'USD'` is created or updated with the new rate and current timestamp. A second call with a different rate replaces the previous value (single-row semantics). |
| 5 | Collector service run | Given the scheduler triggers `ExchangeRateCollectorService.run()`, when the run completes, then a `task_executions` record is created with `products_total = 1`, `products_succeeded = 1` (or `0` if fallback used), `status = 'completed'`, and `finished_at` set. The execution log retains at most 10 records for `exchange-rate-collection-daily`. |
| 6 | Fallback does not fail the execution | Given the constant fallback (tier 3) is used because both EXIM and Naver failed, when the collector run completes, then `task_executions.status = 'completed'` and `products_succeeded = 1` — the run is not marked `failed`. A warning log entry records which sources failed. |
| 7 | Manual trigger returns 202 | Given the collector is idle, when `POST /api/scheduler/exchange-rate/run` is called, then the collection starts asynchronously and `202 { message: "Collection started" }` is returned immediately. |
| 8 | Manual trigger returns 409 when busy | Given the collector is already running, when `POST /api/scheduler/exchange-rate/run` is called again, then `409 { error: "Collection already running" }` is returned. |
| 9 | GET all exchange rates | Given `exchange_rates` has a row for `USD`, when `GET /api/exchange-rates` is called, then `200 ApiResponse<ExchangeRate[]>` is returned containing that row. |
| 10 | GET single currency rate | Given `exchange_rates` has a row for `USD`, when `GET /api/exchange-rates/USD` is called, then `200 ApiResponse<ExchangeRate>` is returned. Given currency `EUR` has no row, when `GET /api/exchange-rates/EUR` is called, then `404` is returned. |
| 11 | POST /update triggers fresh fetch | Given `POST /api/exchange-rates/update` is called (no request body required), when the endpoint is invoked, then `ExchangeRateFetcher.updateUsdRate()` runs synchronously through the 3-tier chain and returns `200 ApiResponse<ExchangeRate>` with the freshly upserted row. This endpoint always triggers a fresh fetch — it does not accept a user-provided rate. |
| 12 | HoldingService FX rate refactor | Given `exchange_rates` has `USD → 1350.0000`, when `HoldingService.fetchFxRates()` is called, then it returns `{ USD: 1350.0, KRW: 1.0 }` sourced from `ExchangeRateRepository.getRate('USD')` — not from `price_history`. Given `exchange_rates` has no row for a currency, then `getRate` returns `1.0` as default. |
| 13 | Scheduler status | When `GET /api/scheduler/exchange-rate/status` is called, then `200 ApiResponse<TaskExecution[]>` is returned with the last 10 execution records for `exchange-rate-collection-daily`, sorted by `started_at` DESC. |
| 14 | Frontend scheduler page | Given the user navigates to the 환율수집 scheduler page, when the page loads, then the last execution status and a run button are displayed. When the user clicks the run button and the collector is idle, then `POST /api/scheduler/exchange-rate/run` is called and the status refreshes. |

---

## 5. Technical Design

### Architecture

```
Cron (daily 0 10 * * * UTC) or POST /api/scheduler/exchange-rate/run
  → ExchangeRateCollectorService.run()
    → ExchangeRateFetcher.fetchUsdRate()
      → Tier 1: EXIM Bank API      (if EXIM_API_KEY set)
      → Tier 2: Naver Finance HTML scraping
      → Tier 3: FALLBACK_USD_KRW = 1350
    → ExchangeRateRepository.upsert('USD', rate)
    → TaskExecutionRepository.complete(execution, { products_total: 1, products_succeeded: 1 })
    → TaskExecutionRepository.trimOldExecutions(taskId, 10)
```

### Database Schema

New table added to `src/server/database/schema.ts`:

```typescript
// PRD-FEAT-016: Exchange Rate Collection Scheduler
export const exchangeRates = pgTable('exchange_rates', {
  id:         serial('id').primaryKey(),
  currency:   text('currency').notNull().unique(),            // 'USD'
  rate:       numeric('rate', { precision: 18, scale: 4 }).notNull(), // 1432.5000
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Single row per currency. `upsert` uses `INSERT ... ON CONFLICT (currency) DO UPDATE SET rate = ..., updated_at = NOW()`.

### Shared TypeScript Types (`src/shared/types.ts`)

```typescript
// PRD-FEAT-016: Exchange Rate Collection Scheduler
export interface ExchangeRate {
  readonly id: number
  readonly currency: string
  readonly rate: string        // numeric stored as string by pg driver
  readonly updated_at: string  // ISO timestamp
}
```

### Component Breakdown

#### ExchangeRateRepository (`src/server/database/exchange-rate-repository.ts`)

| Method | Signature | Notes |
|--------|-----------|-------|
| `findAll` | `(): Promise<readonly ExchangeRate[]>` | All stored rates |
| `findByCurrency` | `(currency: string): Promise<ExchangeRate \| undefined>` | Single rate lookup |
| `upsert` | `(currency: string, rate: number): Promise<ExchangeRate>` | Insert or update |
| `getRate` | `(currency: string): Promise<number>` | Returns `1.0` if not found |

#### ExchangeRateFetcher (`src/server/services/exchange-rate-fetcher.ts`)

| Method | Signature | Notes |
|--------|-----------|-------|
| `fetchUsdRate` | `(): Promise<number>` | 3-tier fallback chain |
| `updateUsdRate` | `(): Promise<ExchangeRate>` | fetch + upsert |
| `fetchFromExim` | `(apiKey: string): Promise<number>` | private |
| `fetchFromNaver` | `(): Promise<number>` | private, HTML scraping |

Constants:
- `FALLBACK_USD_KRW = 1350` (exported const)
- EXIM URL: `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey={key}&searchdate={YYYYMMDD}&data=AP01`
- Naver URL: `https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW`
- Naver scraping target: `<p class="no_today">` element containing `<span class="no{N}">digit</span>` pattern + `<span class="jum">` decimal separator. Digits are assembled into the rate string (e.g., spans `1`,`4`,`3`,`2` + jum + `5`,`0` → `1432.50`).

#### ExchangeRateCollectorService (`src/server/scheduler/exchange-rate-collector-service.ts`)

Follows `PriceCollectorService` / `EtfComponentCollectorService` pattern:
- `run(): Promise<TaskExecution>` — creates execution record, calls fetcher, logs result
- `running` getter — `isRunning` boolean flag
- Logs via `TaskExecutionRepository` with `products_total = 1`
- Trims old executions after each run (keep 10)
- Does NOT implement abort/stop (single atomic operation, no chunking needed)

#### HoldingService change (`src/server/services/holding-service.ts`)

`fetchFxRates()` currently queries `price_history` for `FX:USDKRW`. Change to:

```typescript
// Before
const row = await db.select()...from(priceHistory).where(eq(priceHistory.productCode, 'FX:USDKRW'))...

// After
const usdRate = await exchangeRateRepo.getRate('USD')
return { KRW: 1.0, USD: usdRate }
```

#### API Routes

Data routes — `src/server/routes/exchange-rates.ts`:

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/exchange-rates` | All stored rates | `200 ApiResponse<ExchangeRate[]>` |
| `GET` | `/api/exchange-rates/:currency` | Single rate | `200 ApiResponse<ExchangeRate>` or `404` |
| `POST` | `/api/exchange-rates/update` | Trigger fetch + upsert synchronously | `200 ApiResponse<ExchangeRate>` |

Scheduler routes — `src/server/routes/exchange-rate-scheduler.ts`:

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `POST` | `/api/scheduler/exchange-rate/run` | Trigger async collection | `202` or `409` |
| `GET` | `/api/scheduler/exchange-rate/status` | Last 10 execution records | `200 ApiResponse<TaskExecution[]>` |

#### Scheduler Integration

`startSchedulers` signature extended:

```typescript
export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  priceService: PriceCollectorService,
  etfService: EtfComponentCollectorService,
  exchangeRateService: ExchangeRateCollectorService,
): Promise<void>
```

Dispatch block updated:

```typescript
if (task.name === 'price-collection-daily') {
  await priceService.run()
} else if (task.name === 'etf-component-collection-daily') {
  await etfService.run()
} else if (task.name === 'exchange-rate-collection-daily') {
  await exchangeRateService.run()
} else {
  log('warn', `Unknown scheduled task: ${task.name} — skipping`)
}
```

Seed row (idempotent, `INSERT ON CONFLICT DO NOTHING`):
```
{ name: 'exchange-rate-collection-daily', cron_expression: '0 10 * * *', enabled: true }
```

> Note: `enabled: true` from day 1 because the constant fallback (1350) guarantees a non-null rate even when all external sources fail. This is unlike the ETF component scheduler which required verified real URLs before enabling.

#### Frontend

- `src/client/src/features/scheduler/ExchangeRateSchedulerPage.tsx` — follows `EtfSchedulerPage` pattern: run button, last-execution status badge, execution history table
- `src/client/src/features/scheduler/use-exchange-rate-scheduler.ts` — `useExchangeRateScheduler` hook: status polling, run trigger
- `src/client/src/lib/api.ts` — add `exchangeRate` and `exchangeRateScheduler` API objects
- `src/client/src/navigation.ts` — add nav item "환율수집" with Timer icon in scheduler group
- `src/client/src/routes/system.ts` — add route for the exchange rate scheduler page

### File Structure

```
drizzle/                                          # New migration (0009_*)
src/server/
  database/
    schema.ts                                     # Add exchangeRates table
    exchange-rate-repository.ts                   # New
  services/
    exchange-rate-fetcher.ts                      # New
    holding-service.ts                            # Modify fetchFxRates()
  scheduler/
    exchange-rate-collector-service.ts            # New
    index.ts                                      # Extend startSchedulers
  routes/
    exchange-rates.ts                             # New (data routes)
    exchange-rate-scheduler.ts                    # New (scheduler routes)
  index.ts                                        # Wire new components
src/shared/
  types.ts                                        # Add ExchangeRate type
src/client/src/
  lib/api.ts                                      # Add API objects
  features/scheduler/
    use-exchange-rate-scheduler.ts                # New hook
    ExchangeRateSchedulerPage.tsx                 # New page
  navigation.ts                                   # Add nav item
  routes/system.ts                                # Add route
tests/
  unit/
    exchange-rate-fetcher.test.ts                 # New
    exchange-rate-collector-service.test.ts       # New
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (`exchange_rates` table) + migration + shared type (`ExchangeRate`) in `src/shared/types.ts` + TypeScript compilation check (`npx tsc --noEmit`) | Low |
| 2 | `ExchangeRateRepository` tests (RED) + implementation: `findAll`, `findByCurrency`, `upsert`, `getRate` with default 1.0 (GREEN) | Low |
| 3 | `ExchangeRateFetcher` tests (RED: mock HTTP, verify tier fallback order) + implementation: EXIM tier, Naver scraping tier, constant fallback tier (GREEN) | Medium |
| 4 | `ExchangeRateCollectorService` tests (RED) + implementation: `run()`, `running` getter, execution logging, trim 10 records (GREEN) | Low |
| 5 | Hono routes: `exchange-rates.ts` (data) + `exchange-rate-scheduler.ts` (scheduler) + update `startSchedulers` signature + dispatch block + seed row + server `index.ts` wiring (seed → taskId → service → pass to scheduler) | Medium |
| 6 | `HoldingService.fetchFxRates()` refactor: replace `price_history` query with `ExchangeRateRepository.getRate('USD')` + update tests | Low |
| 7 | Frontend: `useExchangeRateScheduler` hook + `ExchangeRateSchedulerPage` component + `api.ts` additions + `navigation.ts` nav item + `routes/system.ts` route | Medium |

Note: All waves follow the mandatory TDD order — RED (write failing tests) → GREEN (implement to pass) → REFACTOR.

---

## 7. Success Metrics

- [ ] `exchange_rates` table has a `USD` row after the first scheduler run or `POST /api/exchange-rates/update` call
- [ ] `ExchangeRateFetcher` tries EXIM first (when `EXIM_API_KEY` is set), falls back to Naver, then falls back to 1350 constant — verified by unit tests with mocked HTTP
- [ ] Constant fallback (1350) results in `task_executions.status = 'completed'`, not `failed` — execution always succeeds
- [ ] `upsert` replaces the existing `USD` row on subsequent runs (single-row semantics, no duplicate rows)
- [ ] `HoldingService.fetchFxRates()` reads from `exchange_rates` table, not `price_history` — verified by updated unit tests
- [ ] `POST /api/scheduler/exchange-rate/run` returns `202` when idle, `409` when already running
- [ ] `GET /api/scheduler/exchange-rate/status` returns last 10 execution records sorted by `started_at` DESC
- [ ] `GET /api/exchange-rates/USD` returns the current rate; `GET /api/exchange-rates/EUR` returns `404`
- [ ] `task_executions` retains at most 10 rows per task after each run
- [ ] Unit tests achieve 80%+ coverage for `exchange-rate-fetcher.ts` and `exchange-rate-collector-service.ts`
- [ ] TypeScript compiles with zero errors after all changes (`npx tsc --noEmit`)
- [ ] Frontend scheduler page renders last execution status and allows manual run trigger

---

## 8. Dependencies

- PRD-FEAT-005 (Price History Scheduler) — `scheduled_tasks`, `task_executions`, `TaskExecutionRepository`, `startSchedulers`, scheduler dispatch pattern are directly reused
- PRD-FEAT-012 (ETF Component Scheduler) — `EtfComponentCollectorService` is the immediate structural model for `ExchangeRateCollectorService`; `startSchedulers` signature extension follows the same additive-parameter pattern
- PRD-FEAT-014 (Holdings Management) — `HoldingService` is modified to replace `price_history` FX lookup with `exchange_rates` table lookup; holdings portfolio valuation accuracy depends on this PRD
- `cheerio` npm package — HTML parsing for Naver Finance scraping (already added in PRD-FEAT-012; no new dependency if that PRD is merged first)
- Korean EXIM Bank API (`https://www.koreaexim.go.kr`) — optional external data source; requires `EXIM_API_KEY` env var; no rate limiting documented for daily single-request usage
- Naver Finance (`https://finance.naver.com`) — public HTML page scraping; no authentication required; subject to HTML structure changes
- `node-cron` — already present in project for price and ETF component schedulers

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Naver Finance HTML structure changes break scraping | Medium | The constant fallback (1350) ensures the system keeps functioning; unit tests with saved HTML fixtures surface regressions; Naver scraping is tier 2 — EXIM API is preferred when key is available |
| EXIM Bank API endpoint changes or becomes unavailable | Medium | Fetcher gracefully falls through to tier 2 and tier 3; API key is optional — system works without it |
| Constant fallback (1350) becomes significantly stale | Medium | Daily cron re-attempts real sources on every run; the fallback is only used if both external sources fail simultaneously; alert via `warn` log in execution record |
| `HoldingService` refactor breaks existing portfolio valuation | High | Unit tests cover `fetchFxRates()` behavior before and after refactor; `getRate()` returns `1.0` if no row exists — same as previous behavior when `price_history` had no FX record; wave 6 is isolated and independently verifiable |
| `startSchedulers` signature change breaks existing server wiring | Low | Additive parameter appended; update `src/server/index.ts` call site in wave 5; TypeScript compilation check catches missing parameters |
| EXIM API key exposed in logs | Low | `EXIM_API_KEY` is only embedded in the request URL as a query parameter; ensure the URL is not logged at `debug` level in production; use `LOG_LEVEL=info` in production |
| Concurrent exchange rate and price collection competing for DB connections | Low | Each service is independent with its own async lifecycle; PostgreSQL connection pool (`DB_POOL_MAX`) handles concurrency; exchange rate collection is a single lightweight upsert |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-14 | 1.0 | - | Initial PRD for exchange rate collection scheduler, ported from money-bus-v1 patterns, adapted for v3 infrastructure. |
| 2026-03-14 | 1.1 | - | Fix HIGH: clarify POST /update is always fresh fetch (no user-provided rate), document Naver HTML scraping selector target. Status → approved |
