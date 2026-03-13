---
type: prd
prd-id: PRD-FEAT-012
prd-type: feature
title: ETF Component Collection Scheduler (ETF 구성종목 수집 스케줄러)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, scheduler, etf, components, samsung, timefolio, rise, batch]
---

# Feature: ETF Component Collection Scheduler (ETF 구성종목 수집 스케줄러)

## 1. Overview

현재 `products` 테이블에 ETF 종목 메타데이터(이름, 코드, 거래소)가 저장되어 있지만, 각 ETF의 구성종목(holdings) 데이터 — 즉 어떤 주식/채권을 얼마나 보유하고 있는지 — 는 전혀 수집되지 않는다. ETF 구성종목 정보 없이는 ETF 내부 구성을 파악하거나, 보유 ETF를 통한 실질 자산 노출도(underlying exposure)를 분석할 수 없다.

이 기능은 국내 4개 자산운용사(삼성 Active, 삼성 Fund/KODEX, TIMEFOLIO, RISE)의 공개 데이터 소스에서 ETF 구성종목 데이터를 주기적으로 수집하여 PostgreSQL에 저장하는 백엔드 스케줄러를 구현한다. 삼성 계열 펀드는 XLS 파일 다운로드, TIMEFOLIO와 RISE는 HTML 스크래핑 방식을 사용한다. 각 운용사는 고유한 URL 패턴과 파싱 로직을 가지므로, 어댑터 패턴으로 추상화한다. 이미 수집된 날짜(snapshot_date)의 데이터는 재수집하지 않는 멱등 설계를 적용한다.

스케줄러는 기존 가격 수집 스케줄러(`PriceCollectorService`)와 동일한 인프라(scheduledTasks, taskExecutions, startSchedulers, SSE 진행률)를 재사용한다. Phase 1에서는 스키마 정의(etf_profiles + etf_components), 3개 어댑터(Samsung Active XLS, TIMEFOLIO HTML, RISE HTML), 수집 서비스, 스케줄러 통합, 구성종목 조회 API를 구현한다. 구성 변화 추적, 비중 추이, 크로스-ETF 분석, UI 탭 확장은 Phase 2로 미룬다.

---

## 2. User Stories

- As a system, I want to automatically collect ETF constituent holdings data from fund manager websites on a schedule so that the investment analysis features always have up-to-date composition data.
- As a developer, I want to query ETF components by product code and snapshot date so that I can retrieve composition data for analysis.
- As a developer, I want the scheduler to skip snapshot dates that have already been collected so that re-running does not create duplicate entries.
- As a developer, I want failed collections for individual ETFs to be isolated so that one broken data source does not abort the entire run.
- As a developer, I want each fund manager's scraping logic encapsulated in its own adapter so that changes to a single data source only require modifying one file.
- As a system, I want ETF metadata (download URLs, manager, expense ratio) stored separately from price data so that product-specific configuration is not duplicated per snapshot.

---

## 3. Scope

### In Scope

- `etf_profiles` table: extended ETF metadata — `product_id` (FK), `manager`, `expense_ratio`, `download_url`, `download_type` (`xls` | `html`)
- `etf_components` table: constituent holdings per snapshot — `etf_product_id` (FK), `component_symbol`, `component_name`, `weight` (%), `shares`, `snapshot_date`
- Unique constraint on `(etf_product_id, component_symbol, snapshot_date)` — enforces idempotent upsert
- `EtfProfileRepository` (Drizzle ORM): query for ETF profile metadata; `seedProfiles` method uses `INSERT ON CONFLICT DO NOTHING` semantics (no updates to existing rows)
- `EtfComponentRepository` (Drizzle ORM): upsert component rows, query by product + date range, check snapshot existence
- `SamsungActiveAdapter`: fetches XLS from Samsung Active fund manager URL, parses constituent rows (symbol, name, weight, shares)
- `TimefolioAdapter`: scrapes HTML from TIMEFOLIO fund manager pages, parses constituent table rows
- `RiseAdapter`: scrapes HTML from RISE (한국투자신탁운용) fund manager pages, parses constituent table rows
- `EtfComponentCollectorService`: orchestrates adapter selection per ETF, collects today's snapshot per ETF (current adapters only return current-day holdings; adapter interface supports arbitrary dates for future use), 5-ETF chunk size, 500ms inter-chunk delay, snapshot-existence check before fetch (skip if today already collected), per-ETF error isolation, execution logging via existing `TaskExecutionRepository`
- Daily scheduler: cron `0 12 * * *` (UTC 12:00 = KST 21:00), collects all ETF products with a profile row
- Scheduler seeding: idempotent `INSERT ... ON CONFLICT DO NOTHING` for `etf-component-collection-daily` task row on server startup
- Manual trigger API: `POST /api/scheduler/etf-components/run` — 202 if started, 409 if already running
- Stop API: `POST /api/scheduler/etf-components/stop` — aborts current run
- Status API: `GET /api/scheduler/etf-components/status` — last 10 execution records for this task
- Component query API: `GET /api/etf-components?productId={id}&snapshotDate={YYYY-MM-DD}` — returns component rows for a given ETF and date
- Component dates API: `GET /api/etf-components/dates?productId={id}` — returns available snapshot dates for a product
- Shared types: `EtfProfile`, `EtfComponent`, `CreateEtfComponentPayload` added to `src/shared/types.ts`
- SSE progress tracking: reuses existing `updateProgress` on `TaskExecutionRepository` (same `ProgressUpdate` interface)
- `withRetry` reuse: uses existing utility from `src/server/scheduler/with-retry.ts`

### Out of Scope

- Samsung Fund/KODEX adapter (deferred — requires additional reverse-engineering of URL scheme beyond v1 scope)
- Component change tracking / delta detection between snapshots (Phase 2)
- Weight trend analysis or cross-ETF overlap analysis (Phase 2)
- UI tabs for ETF component display on product detail page (Phase 2; handled by a future PRD)
- Authentication/authorization for trigger/stop APIs (internal-only endpoints)
- Real-time or intraday component updates
- Non-ETF product types (equity, bond ETNs outside the 4 fund managers)
- Automatic profile URL discovery — profiles are seeded from a static config file, not auto-discovered

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Seed ETF profiles on startup | Given the server starts, when `startSchedulers` runs, then `etf_profiles` rows are idempotently seeded for all configured ETFs (INSERT ON CONFLICT DO NOTHING). Each profile contains `product_id`, `manager`, `expense_ratio`, `download_url`, `download_type`. Given Wave 1 schema additions are applied, when TypeScript compiles (`npx tsc --noEmit`), then no import errors exist — the `index` export from `drizzle-orm/pg-core` is added to the existing import statement in `schema.ts`. |
| 2 | Collect Samsung Active XLS components | Given an ETF with `download_type = 'xls'` and a Samsung Active `download_url`, when the collector runs for that ETF, then the XLS file is downloaded, parsed row-by-row using column mapping (`종목코드` → `component_symbol`, `종목명` → `component_name`, `비중(%)` → `weight`, `보유수량` → `shares`), and upserted into `etf_components` with today's `snapshot_date`. Rows for the same `(etf_product_id, component_symbol, snapshot_date)` are not duplicated (upsert). Given the XLS contains zero constituent rows, then the adapter returns an empty array and the ETF is counted as `succeeded` with 0 rows upserted (logged at `info` level). |
| 3 | Collect TIMEFOLIO HTML components | Given an ETF with `download_type = 'html'` and a TIMEFOLIO URL, when the collector runs, then the HTML page is fetched, the constituent table is parsed, and rows are upserted into `etf_components` with today's `snapshot_date`. Given the HTML page contains no constituent rows (empty table), then the adapter returns an empty array and the ETF is counted as `succeeded` with 0 rows (logged at `info` level). |
| 4 | Collect RISE HTML components | Given an ETF with `download_type = 'html'` and a RISE URL, when the collector runs, then the HTML page is fetched, the constituent table is parsed (RISE-specific structure), and rows are upserted into `etf_components`. Given the HTML page contains no constituent rows, then the adapter returns an empty array and the ETF is counted as `succeeded` with 0 rows (logged at `info` level). |
| 5 | Skip already-collected snapshot | Given `etf_components` already contains rows for `(etf_product_id, snapshot_date = today)`, when the collector processes that ETF, then the ETF is skipped (counted as `skipped`). No HTTP requests are made for that ETF. |
| 6 | Per-ETF error isolation | Given an adapter throws an error for one ETF, when the collector is processing a batch, then the error is caught, that ETF is marked as `failed` in counters, and processing continues for all remaining ETFs. |
| 7 | Chunked collection with delay | Given a list of N ETFs to collect, when the collector runs, then ETFs are processed in chunks of 5 with a 500ms delay between each chunk (not within). The delay is skipped when it is the last chunk OR when `signal.aborted` is true. |
| 8 | Stop running collection | Given a collection is in progress, when `POST /api/scheduler/etf-components/stop` is called, then `200 { message: "Collection stopping" }` is returned immediately (fire-and-forget abort signal). The current chunk continues to its natural end asynchronously (worst-case ~60s drain). The execution record is eventually marked `aborted`. The caller should poll the status endpoint to confirm final state. Given no collection is in progress, when `POST /api/scheduler/etf-components/stop` is called, then `409 { error: "No collection is currently running" }` is returned. |
| 9 | Query components by product and date | Given `etf_components` rows exist for a product, when `GET /api/etf-components?productId=123&snapshotDate=2026-03-13` is called, then all component rows for that product on that snapshot date are returned, sorted by `weight` DESC (numeric sort at PostgreSQL level via Drizzle `desc(etfComponents.weight)`, not JS string sort). Given `productId` is absent or non-numeric, then `400 Bad Request` is returned. Given `snapshotDate` is absent, then `400 Bad Request` is returned (both `productId` and `snapshotDate` are required). Given `snapshotDate` is present but not a valid `YYYY-MM-DD` date, then `400 Bad Request` is returned. Given a valid `productId` with no component rows for the date (including future dates), then an empty array is returned with `200`. |
| 10 | Query available snapshot dates | Given `etf_components` rows exist for a product, when `GET /api/etf-components/dates?productId=123` is called, then all distinct `snapshot_date` values for that product are returned, sorted DESC. Given `productId` is absent or non-numeric, then `400 Bad Request` is returned. Given a valid `productId` with no data, then an empty array is returned with `200`. |
| 11 | Manual trigger returns 202 | Given the collector is idle, when `POST /api/scheduler/etf-components/run` is called, then the collection starts asynchronously and `202 { message: "Collection started" }` is returned. The caller should poll the status endpoint for execution details. |
| 12 | Manual trigger returns 409 when busy | Given the collector is already running, when `POST /api/scheduler/etf-components/run` is called again, then `409 Conflict` is returned with an error message. |
| 13 | Execution log retained | Given the scheduler completes a run, when `trimOldExecutions` is called, then at most 10 execution records are retained for the `etf-component-collection-daily` task. |
| 14 | Snapshot collection per run | Given an ETF has no prior snapshot for today in `etf_components`, when the collector runs, then it calls the adapter for today's date and upserts the returned components. Given the ETF already has today's snapshot, it is skipped. Note: current adapters (Samsung Active, TIMEFOLIO, RISE) only return current-day holdings — the service calls the adapter with today's date only. The `EtfComponentAdapter.fetchComponents(profile, snapshotDate)` interface accepts a date parameter to support future date-aware adapters that could enable historical backfill. |
| 15 | Unknown manager value rejected at seed time | Given `ETF_PROFILE_SEEDS` contains an entry with an unrecognized `manager` value, when the seed function runs, then a warning is logged and the entry is skipped (not inserted into `etf_profiles`). |
| 16 | Wave 8 real-URL verification gate | Given `ETF_PROFILE_SEEDS` contains at least one real (non-placeholder) URL per manager type (`samsung-active`, `timefolio`, `rise`), when `POST /api/scheduler/etf-components/run` is called, then 202 is returned and at least one `etf_components` row is created in the database. This story must pass before the cron task is set to `enabled: true`. |

---

## 5. Technical Design

### Architecture

```
Scheduler (node-cron)
  └─ EtfComponentCollectorService
       ├─ EtfProfileRepository        (read profiles with download_url)
       ├─ EtfComponentRepository      (check snapshot existence, upsert rows)
       ├─ TaskExecutionRepository     (create/update/complete/trim executions)
       ├─ SamsungActiveAdapter        (XLS download + parse)
       ├─ TimefolioAdapter            (HTML scrape + parse)
       └─ RiseAdapter                 (HTML scrape + parse)
```

### Database Schema (Drizzle additions to `src/server/database/schema.ts`)

> **Import note:** Add `index` to the existing Drizzle imports: `import { ..., index } from 'drizzle-orm/pg-core'`

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
export const etfProfiles = pgTable('etf_profiles', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .unique()
    .references(() => products.id, { onDelete: 'cascade' }),
  manager: text('manager').notNull(),           // constrained to: 'samsung-active' | 'timefolio' | 'rise'
  expenseRatio: numeric('expense_ratio', { precision: 6, scale: 4 }),
  downloadUrl: text('download_url').notNull(),
  downloadType: text('download_type').notNull(), // 'xls' | 'html'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const etfComponents = pgTable('etf_components', {
  id: serial('id').primaryKey(),
  etfProductId: integer('etf_product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  // Note: FK points to products.id (not etf_profiles.id) intentionally.
  // The service layer ensures components are only inserted for products that have
  // an etf_profiles row (profileRepo.findAll() drives the collection loop).
  // This design allows etf_components to exist independently of etf_profiles
  // for potential future manual imports or API-based insertions.
  componentSymbol: text('component_symbol').notNull(),
  componentName: text('component_name').notNull(),
  weight: numeric('weight', { precision: 8, scale: 4 }),   // percentage, e.g. 5.2300
  shares: bigint('shares', { mode: 'number' }),             // number of shares held
  snapshotDate: date('snapshot_date').notNull(),            // YYYY-MM-DD
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('etf_components_product_symbol_date_uniq').on(
    t.etfProductId, t.componentSymbol, t.snapshotDate,
  ),
  index('etf_components_product_date_idx').on(
    t.etfProductId, t.snapshotDate,
  ),
])
```

### Shared TypeScript Types (`src/shared/types.ts` additions)

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
export type EtfManager = 'samsung-active' | 'timefolio' | 'rise'

export interface EtfProfile {
  readonly id: number
  readonly product_id: number
  readonly manager: EtfManager
  readonly expense_ratio: string | null
  readonly download_url: string
  readonly download_type: 'xls' | 'html'
  readonly created_at: string
  readonly updated_at: string
}

export interface EtfComponent {
  readonly id: number
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null   // numeric stored as string by pg driver
  readonly shares: number | null   // bigint with mode:'number'
  readonly snapshot_date: string   // YYYY-MM-DD
  readonly created_at: string
}

export interface CreateEtfComponentPayload {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight?: string | null
  readonly shares?: number | null
  readonly snapshot_date: string
}
```

### Adapter Interfaces

```typescript
// src/server/scheduler/etf-component-adapter.ts
export interface EtfComponentRow {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null
  readonly shares: number | null
  readonly snapshot_date: string
}

export interface EtfComponentAdapter {
  fetchComponents(profile: EtfProfile, snapshotDate: string): Promise<readonly EtfComponentRow[]>
}
```

### Adapter Data Sources

| Manager | `download_type` | Mechanism | Historical Date Support | Notes |
|---------|----------------|-----------|------------------------|-------|
| `samsung-active` | `xls` | HTTP GET `download_url`, parse Excel buffer | **No** — URL returns current-day holdings only | Backfill skipped; only today's snapshot collected |
| `timefolio` | `html` | HTTP GET `download_url`, parse `<table>` DOM with `cheerio` | **No** — page shows current holdings only | Backfill skipped; only today's snapshot collected |
| `rise` | `html` | HTTP GET `download_url`, parse `<table>` DOM with `cheerio` | **No** — page shows current holdings only | Backfill skipped; only today's snapshot collected |

> **Note on backfill (Story 14):** Since none of the current adapters support historical date parameters, the date-range backfill logic exists in the service layer but effectively collects only today's snapshot on each run. If a future adapter supports date parameters, it can return data for arbitrary dates and the backfill loop will collect them. The `ETF_COMPONENT_LOOKBACK_DAYS` env var controls the lookback window for future date-aware adapters. For current adapters, the snapshot-existence check prevents redundant HTTP requests on re-runs within the same day.

### EtfComponentCollectorService

```typescript
// src/server/scheduler/etf-component-collector-service.ts
const ETF_CHUNK_SIZE = 5
const ETF_CHUNK_DELAY_MS = 500

interface CollectionCounters {
  readonly total: number
  readonly succeeded: number
  readonly failed: number
  readonly skipped: number
}
// Updated via spread: counters = { ...counters, succeeded: counters.succeeded + 1 }

export class EtfComponentCollectorService {
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(
    private readonly profileRepo: EtfProfileRepository,
    private readonly componentRepo: EtfComponentRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly adapters: ReadonlyMap<EtfManager, EtfComponentAdapter>,
    private readonly taskId: number,
  ) {}

  get running(): boolean { return this.isRunning }
  abort(): void { this.abortController?.abort() }
  async run(): Promise<TaskExecution>
  private executeCollection(signal: AbortSignal): Promise<TaskExecution>
  private resolveAdapter(manager: string): EtfComponentAdapter | undefined
  private processChunk(profiles: readonly EtfProfile[], snapshotDate: string, signal: AbortSignal, counters: CollectionCounters): Promise<boolean>
}

// Note: task_executions reuse — the existing columns (products_total, products_succeeded,
// products_failed, products_skipped) map to "ETF count" in this context, not price products.
// The status API response should be interpreted accordingly.
```

### Repository Methods

**EtfProfileRepository:**

| Method | Signature | Notes |
|--------|-----------|-------|
| `findAll` | `(): Promise<readonly EtfProfile[]>` | All profiles for collection iteration |
| `findByProductId` | `(productId: number): Promise<EtfProfile \| undefined>` | Single profile lookup |
| `seedProfiles` | `(seeds: readonly EtfProfileSeedEntry[], products: readonly { id: number; code: string }[]): Promise<void>` | `INSERT ON CONFLICT DO NOTHING`; skips entries with unknown `manager` or missing `productCode` in products table (logs warning) |

**EtfComponentRepository:**

| Method | Signature | Notes |
|--------|-----------|-------|
| `upsertMany` | `(rows: readonly CreateEtfComponentPayload[]): Promise<void>` | Upsert on unique constraint |
| `findByProductAndDate` | `(productId: number, snapshotDate: string): Promise<readonly EtfComponent[]>` | Sorted by `weight` DESC (PostgreSQL numeric sort, not JS string sort) |
| `findDatesByProduct` | `(productId: number): Promise<readonly string[]>` | Distinct snapshot dates, sorted DESC |
| `hasSnapshot` | `(productId: number, snapshotDate: string): Promise<boolean>` | Existence check before fetch |

### Scheduler Integration

New task is seeded alongside the price scheduler in `startSchedulers`. The signature of `startSchedulers` is extended:

```typescript
// src/server/scheduler/index.ts
export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  priceService: PriceCollectorService,
  etfService: EtfComponentCollectorService,
): Promise<void>

// Startup wiring sequence in src/server/index.ts:
// 1. Seed the 'etf-component-collection-daily' task row (INSERT ON CONFLICT DO NOTHING)
// 2. Query taskRepo.findByName('etf-component-collection-daily') to get the task's DB id
// 3. Construct EtfComponentCollectorService with the resolved taskId
// 4. Pass etfService into startSchedulers alongside priceService
// This mirrors the existing price collector wiring pattern.
```

The cron loop routes tasks by name to their respective service. This **replaces** the existing unconditional `service.run()` call in `startSchedulers`. `findEnabled()` continues to drive the loop — only the dispatch body changes.

> **Confirmed:** `ScheduledTask` type (in `src/shared/types.ts`) includes a `name: string` field, so `task.name` is available in the dispatch block.

```typescript
// REPLACES the existing: await service.run()
// Inside the cron callback for each enabled task (taskRepo.findEnabled() still drives the loop):
if (task.name === 'price-collection-daily') {
  await priceService.run()
} else if (task.name === 'etf-component-collection-daily') {
  await etfService.run()
} else {
  log('warn', `Unknown scheduled task: ${task.name} — skipping`)
}
```

Seed rows added (idempotent):
- `{ name: 'etf-component-collection-daily', cron_expression: '0 12 * * *', enabled: false }` // UTC 12:00 = KST 21:00

> **Gating:** The task is seeded with `enabled: false`. It must remain disabled until Wave 8 populates real download URLs in `ETF_PROFILE_SEEDS`. After Wave 8 verification, enable the task via direct DB update or admin API. The manual trigger endpoint (`POST /run`) works regardless of the `enabled` flag for testing purposes.

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `POST` | `/api/scheduler/etf-components/run` | Trigger collection manually | `202 { message: "Collection started" }` or `409 { error: "Collection already running" }` |
| `POST` | `/api/scheduler/etf-components/stop` | Abort running collection | `200 { message: "Collection stopping" }` or `409 { error: "No collection is currently running" }` |
| `GET` | `/api/scheduler/etf-components/status` | Last 10 execution records | `ApiResponse<TaskExecution[]>` |
| `GET` | `/api/etf-components` | Query components by product + date | `ApiResponse<EtfComponent[]>` (query params: `productId`, `snapshotDate`) |
| `GET` | `/api/etf-components/dates` | Available snapshot dates for product | `ApiResponse<string[]>` (query param: `productId`) |

### ETF Profile Seed Configuration

```typescript
// src/server/scheduler/etf-profile-seed.ts
export interface EtfProfileSeedEntry {
  readonly productCode: string      // matches products.code
  readonly manager: string
  readonly expenseRatio: string | null
  readonly downloadUrl: string
  readonly downloadType: 'xls' | 'html'
}

// VALID_MANAGERS mirrors EtfManager union from shared types (used for runtime validation)
export const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

export const ETF_PROFILE_SEEDS: readonly EtfProfileSeedEntry[] = [
  // Samsung Active: XLS download from Samsung Asset Management
  // URL pattern: https://www.samsungfund.com/api/v1/etf/{fund_code}/holdings.xls
  { productCode: 'KODEX200', manager: 'samsung-active', expenseRatio: '0.0015', downloadUrl: 'https://...', downloadType: 'xls' },
  // TIMEFOLIO: HTML scrape from Timefolio fund manager page
  // URL pattern: https://www.timefolio.co.kr/etf/{fund_id}
  { productCode: 'TIMEFOLIO...', manager: 'timefolio', expenseRatio: '0.0050', downloadUrl: 'https://...', downloadType: 'html' },
  // RISE (한국투자신탁운용): HTML scrape from RISE ETF page
  // URL pattern: https://www.koreaninvest.com/etf/{fund_code}/holdings
  { productCode: 'RISE...', manager: 'rise', expenseRatio: '0.0030', downloadUrl: 'https://...', downloadType: 'html' },
]

// Seed validation: at startup, log warnings for placeholder URLs and unknown managers
// Entries with unknown manager values are skipped (not seeded)
// Entries with placeholder URLs (containing '...') are seeded but logged at WARN level
```

### File Structure

```
src/server/
  scheduler/
    etf-component-adapter.ts           # EtfComponentAdapter interface + EtfComponentRow
    etf-component-collector-service.ts # EtfComponentCollectorService
    etf-profile-seed.ts                # ETF_PROFILE_SEEDS static config
    samsung-active-adapter.ts          # SamsungActiveAdapter (XLS)
    timefolio-adapter.ts               # TimefolioAdapter (HTML)
    rise-adapter.ts                    # RiseAdapter (HTML)
    index.ts                           # startSchedulers (updated)
  database/
    etf-profile-repository.ts          # EtfProfileRepository
    etf-component-repository.ts        # EtfComponentRepository
  routes/
    etf-components.ts                  # GET /api/etf-components routes
    etf-component-scheduler.ts         # POST/GET /api/scheduler/etf-components routes
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ETF_COMPONENT_LOOKBACK_DAYS` | `30` | Number of past days to collect on first run per ETF. **No-op in Phase 1** — all current adapters return current-day holdings only. Reserved for future date-aware adapters. Effective value is `1` (today only) under current conditions. |

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 0 | Add npm dependencies: `exceljs`, `cheerio` (+ `@types/cheerio` if needed). Verify TypeScript types available. | Low |
| 1 | Drizzle schema additions (`etf_profiles`, `etf_components` with `index` import) + migration + shared types (`EtfManager`, `EtfProfile`, `EtfComponent`, `CreateEtfComponentPayload`) + TypeScript compilation check | Low |
| 2 | Repository tests (RED) + `EtfProfileRepository` (findAll, findByProductId, seedProfiles) + `EtfComponentRepository` (upsertMany, findByProductAndDate, findDatesByProduct, hasSnapshot) (GREEN) | Medium |
| 3 | Adapter interface + `SamsungActiveAdapter` unit tests (RED) + implementation using `exceljs` for XLS parsing (GREEN) | Medium |
| 4 | `TimefolioAdapter` unit tests (RED) + HTML scrape implementation using `cheerio` (GREEN) | Medium |
| 5 | `RiseAdapter` unit tests (RED) + HTML scrape implementation using `cheerio` for RISE-specific table structure (GREEN) | Medium |
| 6 | `EtfComponentCollectorService` tests (RED) + implementation: chunk iteration, adapter resolution, snapshot-existence check, abort support, execution logging (GREEN) | High |
| 7 | Hono routes (`etf-components.ts`, `etf-component-scheduler.ts`) + `startSchedulers` signature update (rename `service` → `priceService`, add `etfService`; update call site in `src/server/index.ts`) + server `index.ts` wiring (seed ETF task row → resolve taskId → construct `EtfComponentCollectorService` → pass to `startSchedulers`) + ETF profile seed + TypeScript compilation verification | Medium |
| 8 | Integration: populate `ETF_PROFILE_SEEDS` with real fund manager URLs for Samsung Active, TIMEFOLIO, RISE ETFs present in `products` table | Medium |

Note: Follows mandatory TDD workflow — tests (RED) written before implementation (GREEN) within each wave, then REFACTOR.

---

## 7. Success Metrics

- [ ] `etf_profiles` rows are seeded idempotently on server startup for all entries in `ETF_PROFILE_SEEDS`
- [ ] `etf_components` receives rows for all seeded ETFs after one full scheduler run
- [ ] No duplicate rows: upsert on `(etf_product_id, component_symbol, snapshot_date)` unique constraint prevents duplicates
- [ ] Snapshot-existence check: if rows already exist for `(etf_product_id, today)`, the ETF is skipped without making HTTP requests
- [ ] Samsung Active XLS adapter correctly parses XLS buffer into component rows (symbol, name, weight, shares)
- [ ] TIMEFOLIO HTML adapter correctly parses constituent table from fund manager page
- [ ] RISE HTML adapter correctly parses constituent table from fund manager page
- [ ] ETFs are processed in chunks of 5 with 500ms delay between chunks (verified in service tests)
- [ ] Per-ETF failure does not abort the full run; remaining ETFs continue processing
- [ ] `withRetry` is applied per-ETF adapter call using existing defaults: `maxRetries=2` (3 total attempts), `baseDelayMs=1000` (1s, 2s exponential backoff). ETF collection uses default parameters without override.
- [ ] `POST /api/scheduler/etf-components/run` returns `202` when idle, `409` when already running
- [ ] `POST /api/scheduler/etf-components/stop` aborts the run; execution record is marked `aborted`
- [ ] `GET /api/scheduler/etf-components/status` returns last 10 execution records sorted by `started_at` DESC
- [ ] `GET /api/etf-components?productId=X&snapshotDate=Y` returns component rows sorted by `weight` DESC
- [ ] `GET /api/etf-components/dates?productId=X` returns distinct snapshot dates sorted DESC
- [ ] `task_executions` table retains at most 10 rows per task after each run
- [ ] Tests achieve 80%+ coverage for scheduler and repository modules

---

## 8. Dependencies

- PRD-FEAT-004 (Product Management) — `products` table with ETF entries is the source for `etf_profiles.product_id`
- PRD-FEAT-005 (Price History Scheduler) — `scheduled_tasks`, `task_executions`, `TaskExecutionRepository`, `withRetry`, `startSchedulers`, and `PriceCollectorService` patterns are directly reused
- `exceljs` npm package — XLS binary parsing for Samsung Active adapter (chosen over `xlsx`/SheetJS for active maintenance and explicit streaming API)
- `cheerio` npm package — HTML parsing for TIMEFOLIO and RISE adapters (chosen over `node-html-parser` for jQuery-like API familiarity and mature ecosystem)
- Samsung Active fund manager website — public XLS download endpoint; URL pattern contains ETF code; no auth required
- TIMEFOLIO fund manager website — public HTML pages; no auth required; subject to structure changes
- RISE (한국투자신탁운용) website — public HTML pages; no auth required; subject to structure changes
- Phase 2 dependency: ETF detail page UI tabs (future PRD) will consume the component query APIs added here

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fund manager website structure changes break HTML parsing | High | Isolate each manager in its own adapter; unit-test with saved HTML fixtures so regressions surface immediately; execution log surfaces failures quickly |
| Samsung Active XLS column layout changes | High | Adapter has column-index constants extracted; integration tests with saved XLS fixtures catch regressions; `etf_profiles.download_url` can be updated without code changes |
| TIMEFOLIO or RISE website IP-based rate limiting | Medium | 500ms inter-chunk delay; `withRetry` handles transient 429/503; reduce parallelism if needed |
| Fund manager websites add authentication or CAPTCHAs | High | No mitigation at this time; affects only those adapters; other managers continue working; alert via execution log failures |
| XLS/HTML library version incompatibility | Low | Pin dependencies to minor versions; wrap library calls in adapter layer for easy swap |
| Growing `etf_components` table size | Low | Index on `(etf_product_id, snapshot_date)` keeps query performance acceptable; at 100 ETFs × 50 components × 365 days ≈ 1.8M rows/year — manageable at current scale |
| `startSchedulers` signature change breaks existing server wiring | Low | Additive parameter added to the function; update `src/server/index.ts` at integration wave (Wave 7). The `service` → `priceService` rename is a refactor — update all call sites. |
| Stop request drain time | Low | When `POST /stop` is called, the current chunk (up to 5 ETFs with `withRetry`) completes before halting. Worst-case drain time: ~60s (5 ETFs × 3 attempts × 4s backoff). This is documented behavior, not a bug. |
| Concurrent ETF and price collection runs interfering | Low | Each service has its own `isRunning` flag and independent `AbortController`; they share only the DB connection pool (PostgreSQL handles concurrency) |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for ETF component collection scheduler, based on v1 component-collector-task system, adapted for PostgreSQL + Drizzle ORM + existing scheduler infrastructure. |
