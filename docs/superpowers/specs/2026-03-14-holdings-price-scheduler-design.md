# Holdings Price Collection Scheduler Design

## Goal

Lightweight price collector that targets only actively held products (shares > 0 from transactions). Runs hourly during KRX market hours for domestic stocks, once daily after US market close for foreign stocks. Complements (does not replace) the existing full-catalog price collector (PRD-FEAT-005).

## Architecture

```
Cron (domestic hourly / foreign daily) or POST /api/scheduler/holdings-price/run
  → ProductRepository.findWithActiveHoldings()
  → resolveAdapter(exchange) to classify domestic/foreign
  → Filter by schedule context:
    - Domestic cron: only KRX/KOSPI/KOSDAQ products
    - Foreign cron: only NYSE/NASDAQ/AMEX products
    - Manual trigger: all held products
  → Fetch price via existing NaverFinanceAdapter / YahooFinanceAdapter
  → PriceHistoryRepository upsert (existing method)
  → TaskExecutionRepository log execution
```

## Key Differences from Existing Price Collector (PRD-FEAT-005)

| Aspect | Existing (PRD-FEAT-005) | This PRD |
|--------|------------------------|----------|
| Scope | All products in catalog | Only held products (shares > 0) |
| Frequency | Daily 1x (20:00 UTC) | Domestic hourly + foreign daily |
| Lookback | 380 days | 1 day (today only) |
| Purpose | Full catalog history | Real-time portfolio valuation |
| Adapters | Same Naver + Yahoo | Reuses same adapters |

## Database

No new tables. Uses existing `products`, `transactions`, `price_history` tables.

New repository method:
```
ProductRepository.findWithActiveHoldings(): Promise<readonly Product[]>
  → SELECT DISTINCT p.* FROM products p
    JOIN transactions t ON t.product_id = p.id
    GROUP BY p.id
    HAVING SUM(CASE WHEN t.type='buy' THEN t.shares ELSE -t.shares END) > 0
```

## Components

### HoldingsPriceCollectorService
- `run(scope: 'domestic' | 'foreign' | 'all')` → `Promise<TaskExecution>`
- `running` getter
- Reuses existing `NaverFinanceAdapter`, `YahooFinanceAdapter`, `exchange-routing.ts`
- Lookback: `startDate = endDate = today` (1 day only)
- Execution logging via `TaskExecutionRepository`
- Trims old executions (keep 10 per task)

### Scheduler Integration
Two seed rows:
- `holdings-price-domestic`: cron `0 0-7 * * 1-5` (UTC) = KST 09:00~16:00 weekdays
- `holdings-price-foreign`: cron `0 22 * * 1-5` (UTC) = KST 07:00 Tue-Sat

`startSchedulers` extended with `holdingsPriceService` parameter.

Dispatch logic:
- `holdings-price-domestic` → `service.run('domestic')`
- `holdings-price-foreign` → `service.run('foreign')`

### API Routes
Scheduler routes (`/api/scheduler/holdings-price`):
- `POST /run` — manual trigger (scope='all'), 202/409
- `GET /status` — last 10 execution records (combined from both tasks)

### Frontend
- Nav item: "보유종목 가격" in scheduler group
- Page: existing scheduler pattern (run button + execution history)
- Hook: `useHoldingsPriceScheduler`

## File Structure

```
src/server/
  database/
    product-repository.ts           # Add findWithActiveHoldings()
  scheduler/
    holdings-price-collector-service.ts  # New
    index.ts                        # Extend startSchedulers
  routes/
    holdings-price-scheduler.ts     # New
  index.ts                          # Wire new service + routes
src/shared/
  types.ts                          # No changes needed
src/client/src/
  lib/api.ts                        # Add holdingsPriceScheduler API
  features/scheduler/
    use-holdings-price-scheduler.ts  # New hook
    HoldingsPriceSchedulerPage.tsx   # New page
  navigation.ts                     # Add nav item
  routes/system.ts                  # Add route
tests/unit/
  holdings-price-collector-service.test.ts  # New
```

## Environment Variables
None new — reuses existing adapter configuration.
