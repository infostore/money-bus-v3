---
type: prd
prd-id: PRD-FEAT-005
prd-type: feature
title: Price History Scheduler (종목 가격 수집 스케줄러)
status: approved
implementation-status: completed
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, scheduler, price, naver-finance, yahoo-finance, batch]
---

# Feature: Price History Scheduler (종목 가격 수집 스케줄러)

## 1. Overview

현재 `products` 테이블에 1,806개 종목의 메타데이터(이름, 코드, 거래소)가 저장되어 있지만, 각 종목의 일별 OHLCV(Open/High/Low/Close/Volume) 가격 데이터는 전혀 수집되지 않는다. 가격 이력 없이는 수익률 계산, 포트폴리오 가치 평가, 자산 추이 분석이 불가능하다. 이 기능은 외부 시세 API에서 OHLCV 데이터를 자동으로 수집하여 PostgreSQL에 저장하는 백엔드 스케줄러를 구현한다.

국내 종목(exchange: KRX / KOSPI / KOSDAQ)은 Naver Finance 비공식 API를, 해외 종목(exchange: NASDAQ / NYSE / 등)은 Yahoo Finance API를 사용한다. 배치 처리 시 국내 종목은 20개씩 묶어 1초 딜레이, 해외 종목은 10개씩 묶어 2초 딜레이를 두어 API 속도 제한을 준수한다. 네트워크 오류 및 일시적 장애에 대비해 최대 2회 재시도하는 exponential backoff 전략을 적용한다.

스케줄러는 두 가지 실행 모드를 지원한다. 전체 수집 모드(daily, 매일 오후 8시)는 모든 종목의 가격 이력을 수집하며, 이미 수집된 날짜 이후의 데이터만 가져오는 incremental 방식으로 동작한다. 보유 종목 수집 모드(hourly)는 `holdings` 테이블이 구현된 이후의 PRD에서 처리한다. 스케줄 실행 이력은 `task_executions` 테이블에 최근 10건을 보관하여 관리자가 실행 결과를 추적할 수 있다.

---

## 2. User Stories

- As a system, I want to automatically collect daily OHLCV price data for all products so that portfolio valuation and return calculations are always up to date.
- As a developer, I want to monitor scheduler execution history so that I can quickly diagnose collection failures.
- As a developer, I want the scheduler to resume from the last collected date so that re-running after downtime does not duplicate data.
- As a developer, I want failed API requests to be retried with exponential backoff so that transient network errors do not cause data gaps.
- As a developer, I want domestic and foreign products to use appropriate APIs (Naver Finance / Yahoo Finance) so that price data is accurate for each exchange.

---

## 3. Scope

### In Scope

- `price_history` table (Drizzle schema + migration): stores daily OHLCV per product
- `scheduled_tasks` table: task definitions (name, cron expression, enabled flag)
- `task_executions` table: execution log (started_at, finished_at, status, message, counts), retained latest 10 records per task
- `PriceHistoryRepository` (Drizzle ORM): upsert price rows, query last collected date per product
- `ScheduledTaskRepository` / `TaskExecutionRepository` (Drizzle ORM): task definition management and execution logging
- Naver Finance adapter: fetches domestic OHLCV for KRX / KOSPI / KOSDAQ products by code, batch 20 with 1-second delay
- Yahoo Finance adapter: fetches foreign OHLCV for NASDAQ / NYSE / AMEX / TSE products by code, batch 10 with 2-second delay
- `withRetry` utility: 2 retries, exponential backoff (1s → 2s base), per-product error isolation
- `PriceCollectorService`: orchestrates product-to-adapter routing, incremental date range calculation, batch processing, execution logging
- Daily scheduler: cron `0 20 * * *` (KST 20:00 = UTC 11:00), collects all products with a valid code and known exchange
- Manual trigger API: `POST /api/scheduler/price-collection/run` for on-demand execution (admin use)
- Scheduler status API: `GET /api/scheduler/price-collection/status` returns last 10 execution records
- Exchange routing: KRX / KOSPI / KOSDAQ → Naver; NASDAQ / NYSE / AMEX / TSX → Yahoo
- Incremental collection: uses `MAX(date)` from `price_history` per product as the start date for the next fetch

### Out of Scope

- Hourly holding-based collection mode (`holdings` table does not exist yet; deferred to a future PRD)
- Real-time (intraday) price streaming
- UI for price history visualization or scheduler management (admin panel is a separate feature)
- Cryptocurrency price collection (UPBIT / BINANCE adapters)
- Dividend or stock-split history collection
- Products with no `code` field are skipped silently (code is optional in products table)
- Authentication / authorization for trigger API (internal-only endpoint)

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Collect domestic prices | Given products with exchange in {KRX, KOSPI, KOSDAQ} and a non-null code, when the scheduler runs, then Naver Finance API is called in batches of 20 with 1-second inter-batch delay. Each product's OHLCV rows are upserted into `price_history`. Rows already present for a date are not duplicated (upsert on `product_id + date`). |
| 2 | Collect foreign prices | Given products with exchange in {NASDAQ, NYSE, AMEX, TSX} and a non-null code, when the scheduler runs, then Yahoo Finance API is called in batches of 10 with 2-second inter-batch delay. Results are upserted into `price_history`. |
| 3 | Incremental collection | Given a product already has price rows up to date D, when the scheduler runs, then only dates after D are requested from the API. If no rows exist, collection starts from `PRICE_HISTORY_DEFAULT_LOOKBACK_DAYS` days ago (env var, default: `365`). |
| 4 | Retry on failure | Given an API call fails with a network or HTTP 5xx error, when `withRetry` is invoked, then the call is retried up to 2 times with delays of 1s and 2s. If all retries fail, the product is marked as failed in the execution log and processing continues for remaining products. |
| 5 | Execution logging | Given the scheduler starts, when it completes (success or partial failure), then a row is inserted into `task_executions` with: `started_at`, `finished_at`, `status` (success/partial/failed), `products_total`, `products_succeeded`, `products_failed`, `message`. Only the most recent 10 records are retained per task (older rows deleted). |
| 6 | Manual trigger | Given the scheduler is not already running, when `POST /api/scheduler/price-collection/run` is called, then a collection run is started asynchronously and `202 Accepted` is returned with `{ run_id }` where `run_id` is the `task_executions.id` (integer) of the newly created execution record. Concurrent invocation while running returns `409 Conflict`. |
| 7 | Execution status query | Given past executions exist, when `GET /api/scheduler/price-collection/status` is called, then the last 10 execution records are returned sorted by `started_at` DESC. |
| 8 | Products without code skipped | Given products with `code = null`, when the scheduler runs, then those products are skipped silently. The skip count is recorded in the execution log (`products_skipped` field). |
| 9 | Unknown exchange handled | Given a product with an exchange value not in the routing map (e.g., UPBIT), when the scheduler encounters it, then the product is skipped with a warning log entry. Skip count is incremented. |

---

## 5. Technical Design

### Architecture

```
Scheduler (node-cron)
  └─ PriceCollectorService
       ├─ ProductRepository        (read all products with code != null)
       ├─ PriceHistoryRepository   (read last date, upsert rows)
       ├─ TaskExecutionRepository  (insert/trim execution log)
       ├─ NaverFinanceAdapter      (domestic OHLCV via Naver API)
       └─ YahooFinanceAdapter      (foreign OHLCV via yahoo-finance2)
```

### Database Schema (Drizzle)

```typescript
// src/server/database/schema.ts (additions)
import { pgTable, serial, text, integer, bigint, numeric, date, timestamp, boolean, unique } from 'drizzle-orm/pg-core'

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),                    // YYYY-MM-DD, market date
  open: numeric('open', { precision: 18, scale: 4 }),
  high: numeric('high', { precision: 18, scale: 4 }),
  low: numeric('low', { precision: 18, scale: 4 }),
  close: numeric('close', { precision: 18, scale: 4 }).notNull(),
  volume: bigint('volume', { mode: 'number' }),    // bigint for high-volume markets (KOSPI can exceed INT4 max)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.productId, t.date),          // Enforces no duplicate daily rows per product
}))

export const scheduledTasks = pgTable('scheduled_tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),           // e.g. 'price-collection-daily'
  cronExpression: text('cron_expression').notNull(), // e.g. '0 11 * * *' (UTC)
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const taskExecutions = pgTable('task_executions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => scheduledTasks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'), // 'running' | 'success' | 'partial' | 'failed'
  productsTotal: integer('products_total').notNull().default(0),
  productsSucceeded: integer('products_succeeded').notNull().default(0),
  productsFailed: integer('products_failed').notNull().default(0),
  productsSkipped: integer('products_skipped').notNull().default(0),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### Shared TypeScript Types (src/shared/types.ts)

```typescript
// PRD-FEAT-005: Price Scheduler
export interface PriceHistory {
  readonly id: number
  readonly product_id: number
  readonly date: string              // YYYY-MM-DD
  readonly open: string | null       // numeric stored as string by pg driver
  readonly high: string | null
  readonly low: string | null
  readonly close: string
  readonly volume: number | null       // bigint with mode:'number' — safe up to Number.MAX_SAFE_INTEGER
  readonly created_at: string
}

export interface ScheduledTask {
  readonly id: number
  readonly name: string
  readonly cron_expression: string
  readonly enabled: boolean
  readonly created_at: string
  readonly updated_at: string
}

export interface TaskExecution {
  readonly id: number
  readonly task_id: number
  readonly started_at: string
  readonly finished_at: string | null
  readonly status: 'running' | 'success' | 'partial' | 'failed'
  readonly products_total: number
  readonly products_succeeded: number
  readonly products_failed: number
  readonly products_skipped: number
  readonly message: string | null
  readonly created_at: string
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PRICE_HISTORY_DEFAULT_LOOKBACK_DAYS` | `365` | Number of days to look back when collecting prices for a product with no existing history |

### Exchange Routing Map

```typescript
// src/server/scheduler/exchange-routing.ts
const DOMESTIC_EXCHANGES = new Set(['KRX', 'KOSPI', 'KOSDAQ'])
const FOREIGN_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'TSX'])

type AdapterType = 'naver' | 'yahoo' | 'unknown'

export function resolveAdapter(exchange: string | null): AdapterType {
  if (!exchange) return 'unknown'
  if (DOMESTIC_EXCHANGES.has(exchange)) return 'naver'
  if (FOREIGN_EXCHANGES.has(exchange)) return 'yahoo'
  return 'unknown'
}
```

### Retry Utility

```typescript
// src/server/scheduler/with-retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000,
): Promise<T> {
  // attempt 0: immediate (no delay)
  // attempt 1: delay = baseDelayMs * 2^0 = 1000ms
  // attempt 2: delay = baseDelayMs * 2^1 = 2000ms
  // Formula: delay(attempt) = baseDelayMs * 2^(attempt - 1)
  // Throws last error after maxRetries exhausted
}
```

### Naver Finance Adapter

- Endpoint: `https://api.finance.naver.com/siseJson.naver?symbol={code}&requestType=1&startTime={YYYYMMDD}&endTime={YYYYMMDD}&timeframe=day`
- Returns JSON-like string with single-quoted arrays (must sanitize before parsing)
- Each product results in **one API call**. After every 20 consecutive calls, a 1-second delay is inserted before the next group.
- If the API returns 200 with an empty array, the product is treated as successful with 0 rows inserted.

**Response fixture** (saved to `tests/fixtures/naver-sise-response.json`):

```json
[
  ["날짜", "시가", "고가", "저가", "종가", "거래량", "외국인소진율"],
  ["20260312", 78000, 78500, 77200, 77800, 12345678, 52.1],
  ["20260311", 77500, 78200, 77000, 78000, 9876543, 52.0]
]
```

- Row 0 is the header (ignored)
- Field indices: `[0]=date(YYYYMMDD)`, `[1]=open`, `[2]=high`, `[3]=low`, `[4]=close`, `[5]=volume`
- Remaining fields (e.g., foreign ownership rate) are ignored
- Date string `YYYYMMDD` is converted to `YYYY-MM-DD` for storage

### Yahoo Finance Adapter

- Uses `yahoo-finance2` npm package (official unofficial library, typed)
- Calls `yahooFinance.historical(code, { period1, period2, interval: '1d' })`
- Maps response to `PriceRow[]`
- Called per-product; batch loop applies 2-second sleep between each group of 10

### PriceCollectorService

```typescript
// src/server/scheduler/price-collector-service.ts
export class PriceCollectorService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceHistoryRepo: PriceHistoryRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly naverAdapter: NaverFinanceAdapter,
    private readonly yahooAdapter: YahooFinanceAdapter,
    private readonly taskId: number,
  ) {}

  async run(): Promise<TaskExecution>
  private processProduct(product: Product): Promise<'success' | 'failed' | 'skipped'>
  private collectDateRange(product: Product): Promise<{ from: Date; to: Date }>
}
```

### Scheduler Entry

The `scheduled_tasks` table is the **single source of truth** for cron expressions and the `enabled` flag. On server startup:

1. **Seed task row**: Idempotent `INSERT ... ON CONFLICT (name) DO NOTHING` inserts `{ name: 'price-collection-daily', cron_expression: '0 11 * * *', enabled: true }` into `scheduled_tasks`.
2. **Recover stale runs**: Query `task_executions` for rows with `status = 'running'` and mark them as `'failed'` with `message = 'Interrupted by server restart'` and `finished_at = now()`.
3. **Register cron**: Read all `enabled` tasks from `scheduled_tasks` and register each with `node-cron` using the stored `cron_expression`.

```typescript
// src/server/scheduler/index.ts
import { schedule } from 'node-cron'

export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  service: PriceCollectorService,
): Promise<void> {
  // Step 1: Seed default task (idempotent)
  await taskRepo.seedDefault({
    name: 'price-collection-daily',
    cronExpression: '0 11 * * *',
    enabled: true,
  })

  // Step 2: Recover stale 'running' executions from prior crash
  await executionRepo.recoverStaleRuns()

  // Step 3: Register cron from DB
  const tasks = await taskRepo.findEnabled()
  for (const task of tasks) {
    schedule(task.cronExpression, () => {
      service.run().catch(err => log('error', `Scheduler error: ${err}`))
    })
  }
}
```

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| POST | `/api/scheduler/price-collection/run` | Trigger collection manually | `202` `{ success: true, data: { run_id: number } }` (`run_id` = `task_executions.id`) or `409` if running |
| GET | `/api/scheduler/price-collection/status` | Last 10 execution records | `ApiResponse<TaskExecution[]>` |

### File Structure

```
src/server/
  scheduler/
    index.ts                    # node-cron setup, startSchedulers()
    exchange-routing.ts         # resolveAdapter() map
    with-retry.ts               # withRetry<T>() utility
    price-collector-service.ts  # PriceCollectorService
    naver-finance-adapter.ts    # NaverFinanceAdapter
    yahoo-finance-adapter.ts    # YahooFinanceAdapter
  database/
    price-history-repository.ts
    scheduled-task-repository.ts
    task-execution-repository.ts
  routes/
    scheduler.ts                # POST /run, GET /status
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema additions (`price_history`, `scheduled_tasks`, `task_executions`) + migration + shared types (`PriceHistory`, `ScheduledTask`, `TaskExecution`) | Low |
| 2 | Repository tests (RED) + `PriceHistoryRepository` implementation with upsert and last-date query (GREEN) | Medium |
| 3 | Repository tests (RED) + `ScheduledTaskRepository` + `TaskExecutionRepository` with 10-record retention trim (GREEN) | Low |
| 4 | Unit tests (RED) + `withRetry` utility + `exchange-routing` (GREEN) | Low |
| 5 | Integration tests (RED) + `NaverFinanceAdapter` with batch/delay logic (GREEN) — use mock HTTP in tests | Medium |
| 6 | Integration tests (RED) + `YahooFinanceAdapter` using `yahoo-finance2` (GREEN) — use mock in tests | Medium |
| 7 | Service tests (RED) + `PriceCollectorService` orchestration: routing, incremental date range, batch execution, execution logging (GREEN) | High |
| 8 | Scheduler entry (`startSchedulers`), server integration in `src/server/index.ts` (seed `scheduled_tasks` row on startup), Hono routes for `/api/scheduler/*` | Low |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] `price_history` table receives OHLCV rows for all products with a non-null code and known exchange after one full scheduler run
- [ ] No duplicate rows: upsert on `(product_id, date)` unique constraint prevents duplicates
- [ ] Incremental mode: re-running scheduler the next day fetches only the new day's data, not full history
- [ ] Domestic batch: Naver API is called with groups of ≤ 20 products, with ≥ 1-second delay between groups
- [ ] Foreign batch: Yahoo Finance is called with groups of ≤ 10 products, with ≥ 2-second delay between groups
- [ ] `withRetry` retries exactly 2 times on transient failure before marking product as failed
- [ ] Per-product failure does not abort the full run; remaining products continue
- [ ] `task_executions` table retains at most 10 rows per task after each run
- [ ] `GET /api/scheduler/price-collection/status` returns last 10 execution records sorted by `started_at` DESC
- [ ] `POST /api/scheduler/price-collection/run` returns `202` on success, `409` when already running
- [ ] Products with `code = null` are silently skipped and counted in `products_skipped`
- [ ] Products with unknown exchange are silently skipped with a `warn` log and counted in `products_skipped`
- [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines) for scheduler module
- [ ] Daily scheduler cron expression matches `0 11 * * *` (UTC), equivalent to 20:00 KST, and is read from the `scheduled_tasks` DB row

---

## 8. Dependencies

- PRD-FEAT-004 (Product Management) — `products` table with `code` and `exchange` fields is the source of products to collect; 1,806 rows already seeded
- `node-cron` npm package — cron scheduling for Node.js
- `yahoo-finance2` npm package — typed Yahoo Finance API client
- Naver Finance API — unofficial public endpoint, no API key required; subject to rate limiting and format changes
- PostgreSQL `numeric` type — for OHLCV price fields to avoid floating-point precision loss
- `node-fetch` or native `fetch` (Node 18+) — HTTP client for Naver Finance adapter
- Future dependency: Holdings PRD — hourly holding-based collection mode blocked on `holdings` table

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Naver Finance API is unofficial and undocumented | High | Isolate in `NaverFinanceAdapter`; add integration test with response fixture; monitor via execution log |
| Naver Finance API format change breaks parser | High | Parser is isolated in adapter; unit tests with saved response fixtures catch regressions early |
| Yahoo Finance rate limiting or IP bans | Medium | 2-second inter-batch delay; exponential backoff on 429 responses; keep batch size ≤ 10 |
| 1,806 products × API latency per run exceeds nightly window | Medium | Incremental collection (only new dates per product); parallel adapter calls within a batch if latency budget is exceeded — defer parallelism optimization to a follow-up |
| PostgreSQL row explosion (1,806 products × 365 days = ~659K rows) | Low | Numeric storage is efficient; add index on `(product_id, date)` unique constraint; no archival needed at current scale |
| Concurrent scheduler runs causing data corruption | Medium | `PriceCollectorService` tracks in-memory `isRunning` flag; `/run` endpoint returns 409 if already running. On server restart, stale `running` execution rows are marked `failed` with `message = 'Interrupted by server restart'` (see Scheduler Entry section). Known limitation: in-memory flag does not work across multi-process deployments (single-process is sufficient for this project). |
| Network interruption mid-run leaves partial data | Low | Incremental upsert per product; next run resumes from last successfully stored date |
| `yahoo-finance2` breaking API change | Low | Pin minor version in package.json; wrap in adapter for easy swap |
| Products with invalid or delisted codes cause API errors | Low | Per-product error isolation; log failed product codes; mark products_failed in execution record |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for price history scheduler, adapted from v1 scheduler design for PostgreSQL + Drizzle ORM stack. |
| 2026-03-13 | 1.1 | - | Review fixes: volume→bigint, added unique constraint on (product_id,date), Naver response fixture, DB-driven cron, seeding mechanism, stale run recovery, lookback env var, run_id clarification, retry formula spec. |
