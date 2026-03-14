# Exchange Rate Scheduler Design

## Goal

Daily USD/KRW exchange rate collection with 3-tier source fallback, stored in a dedicated `exchange_rates` table. Ported from money-bus-v1 patterns, adapted to v3 infrastructure (Drizzle ORM, PostgreSQL, node-cron, existing scheduler framework).

## Architecture

```
Cron (daily, 1x) or POST /api/scheduler/exchange-rate/run
  → ExchangeRateFetcher.fetchUsdRate()
    → 1st: EXIM API (if EXIM_API_KEY set)
    → 2nd: Naver Finance scraping (no API key)
    → 3rd: fallback constant (1350)
  → ExchangeRateRepository.upsert('USD', rate)
  → TaskExecutionRepository logs execution result
```

## Database

New table `exchange_rates`:

```sql
exchange_rates (
  id          SERIAL PRIMARY KEY,
  currency    TEXT NOT NULL UNIQUE,       -- 'USD'
  rate        NUMERIC(18,4) NOT NULL,     -- 1432.5000
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)
```

Single row for USD. Schema supports future multi-currency extension but only USD is collected.

## Components

### ExchangeRateRepository
- `findAll()` → `readonly ExchangeRate[]`
- `findByCurrency(currency)` → `ExchangeRate | undefined`
- `upsert(currency, rate)` → `ExchangeRate`
- `getRate(currency)` → `number` (returns 1.0 if not found)

### ExchangeRateFetcher
- `fetchUsdRate()` → `Promise<number>` — 3-tier source chain
- `updateUsdRate()` → `Promise<ExchangeRate>` — fetch + upsert
- Private: `fetchFromExim(apiKey)`, `fetchFromNaver()`
- EXIM URL: `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey={key}&searchdate={YYYYMMDD}&data=AP01`
- Naver URL: `https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW`
- Fallback: `FALLBACK_USD_KRW = 1350`

### ExchangeRateCollectorService
- Follows existing `PriceCollectorService` / `EtfComponentCollectorService` pattern
- `run()` → `Promise<TaskExecution>` — creates execution record, calls fetcher, completes record
- `running` getter, `isRunning` flag
- Logs via `TaskExecutionRepository` (products_total=1, products_succeeded=0|1, etc.)
- Trims old executions (keep 10)

### HoldingService Change
- `fetchFxRates()` currently queries `price_history` for `FX:USDKRW` product
- Change to query `exchange_rates` table directly via `ExchangeRateRepository.getRate(currency)`
- KRW → 1.0, other currencies → `exchange_rates` lookup, missing → null

### API Routes

Data routes (`/api/exchange-rates`):
- `GET /` — all exchange rates
- `GET /:currency` — single rate (404 if not found)
- `POST /update` — manual fetch + upsert (returns updated rate)

Scheduler routes (`/api/scheduler/exchange-rate`):
- `POST /run` — trigger async collection (202/409)
- `GET /status` — last 10 execution records

### Scheduler Integration
- Seed row: `{ name: 'exchange-rate-collection-daily', cronExpression: '0 10 * * *', enabled: true }`
- Cron: daily 10:00 UTC (19:00 KST) — after market close, before price collection (20:00 UTC)
- `startSchedulers` extended with `exchangeRateService` parameter
- Dispatch block for `exchange-rate-collection-daily`

### Frontend
- Scheduler nav item: "환율수집" with Timer icon
- Page: `EtfSchedulerPage` pattern — run button, execution history table
- Hook: `useExchangeRateScheduler` — status polling, run trigger

### Shared Types
```typescript
export interface ExchangeRate {
  readonly id: number
  readonly currency: string
  readonly rate: string  // numeric as string for precision
  readonly updated_at: string
}
```

## Environment Variables
- `EXIM_API_KEY` — optional, Korean EXIM Bank API key

## File Structure

```
drizzle/                                    # New migration
src/server/
  database/
    schema.ts                               # Add exchange_rates table
    exchange-rate-repository.ts             # New
  services/
    exchange-rate-fetcher.ts                # New
    holding-service.ts                      # Modify fetchFxRates()
  scheduler/
    exchange-rate-collector-service.ts      # New
    index.ts                                # Modify startSchedulers
  routes/
    exchange-rates.ts                       # New (data routes)
    exchange-rate-scheduler.ts              # New (scheduler routes)
  index.ts                                  # Wire new components
src/shared/
  types.ts                                  # Add ExchangeRate type
src/client/src/
  lib/api.ts                                # Add exchangeRate + exchangeRateScheduler
  features/scheduler/
    use-exchange-rate-scheduler.ts           # New hook
    ExchangeRateSchedulerPage.tsx            # New page
  navigation.ts                             # Add nav item
  routes/system.ts                          # Add route
tests/
  unit/
    exchange-rate-fetcher.test.ts           # New
    exchange-rate-collector-service.test.ts  # New
```

## Source Reference
- v1 fetcher: `money-bus-v1/src/server/services/exchange-rate-fetcher.ts`
- v1 collector task: `money-bus-v1/src/server/scheduler/exchange-rate-collector-task.ts`
- v1 repository: `money-bus-v1/src/server/database/exchange-rate-repository.ts`
- v1 routes: `money-bus-v1/src/server/routes/exchange-rates.ts`
