---
type: prd
prd-id: PRD-FEAT-018
prd-type: feature
title: Scheduler Execution Detail
status: approved
implementation-status: not-started
created: 2026-03-14
updated: 2026-03-14
author: -
tags: [prd]
---

# Feature: Scheduler Execution Detail

## 1. Overview

The scheduler pages (가격 수집, ETF 구성종목, 환율, 보유종목 가격) currently show execution summary rows with aggregate counters (성공/전체, 실패, 건너뜀). When a partial failure or unexpected skip occurs, there is no way to know which specific products were affected or why. Operators must resort to server logs or re-running the scheduler to diagnose root-cause issues, which wastes time and risks masking persistent failures for individual products.

This feature introduces a `task_execution_details` table that records a per-product result row for each scheduler execution. A new detail page, reachable by clicking any execution row on any scheduler page, presents an itemised list showing each product's status and error message. The detail API is unified across all four scheduler types (price collection, holdings price, ETF components, exchange rate) so a single endpoint and single page component cover every context.

The expected impact is faster diagnosis of collection failures: operators can immediately identify which products are failing and why, without leaving the browser or reading raw logs.

## 2. User Stories

- As an operator, I want to see which individual products succeeded, failed, or were skipped in a scheduler run so that I can diagnose partial failures without reading server logs.
- As an operator, I want to click an execution row and land on a detail page so that I can review per-product results in context.
- As an operator, I want to see the error message for each failed product so that I can understand the root cause and take corrective action.
- As an operator, I want the detail page to clearly label the scheduler type (가격 수집, ETF 구성종목, 환율, 보유종목 가격) so that I know which collection produced the results I am reviewing.

## 3. Scope

### In Scope
- New `task_execution_details` table with columns: `id`, `execution_id` (FK → `task_executions`), `product_id` (FK → `products`, nullable for schedulers that do not operate per-product such as exchange rate), `status` (`success` | `failed` | `skipped`), `message` (nullable), `created_at`
- Server-side detail writing: each collector service writes one detail row per product after processing it
- REST endpoint `GET /api/scheduler/executions/:id/details` returning the full detail list for a given execution
- Detail page accessible by clicking any execution row on all four scheduler pages: `SchedulerPage`, `EtfSchedulerPage`, `HoldingsPriceSchedulerPage`, `ExchangeRateSchedulerPage`
- TanStack Router route at `/scheduler/executions/:executionId` (shared across all scheduler contexts)
- Detail page shows: execution summary (status, started_at, duration, counts), plus a table of per-product rows (product name/code, status badge, error message)
- Drizzle schema update + migration

### Out of Scope
- Editing or deleting individual detail rows (detail rows are immutable audit records)
- Pagination of detail rows (a single execution processes at most a few hundred products; full list is acceptable)
- Real-time polling of in-progress detail rows (detail page shows a snapshot; user refreshes manually or navigates back after execution completes)
- Filtering or sorting detail rows on the client beyond the default server-side order (by `id` ascending, i.e. processing order)
- Retention policy for detail rows (follow the same manual-delete behaviour as execution rows in PRD-FEAT-008)
- Exposing detail rows via websocket or SSE

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | As an operator, I want per-product detail rows written during each scheduler run | Given a scheduler execution runs, when each product is processed, then a `task_execution_details` row is inserted with `execution_id`, `product_id` (or NULL for exchange rate), `status`, and `message` |
| 2 | As an operator, I want to retrieve detail rows via API | Given execution id `42` exists, when `GET /api/scheduler/executions/42/details` is called, then a 200 response with `{ success: true, data: TaskExecutionDetail[] }` is returned ordered by `id` ascending |
| 3 | As an operator, I want the API to return 404 when the execution does not exist | Given execution id `9999` does not exist, when `GET /api/scheduler/executions/9999/details` is called, then a 404 `{ success: false, data: null, error: "Execution not found" }` is returned |
| 4 | As an operator, I want to navigate to the detail page by clicking an execution row | Given I am on any scheduler page, when I click an execution row, then I am navigated to `/scheduler/executions/:executionId` |
| 5 | As an operator, I want the detail page to show the execution summary and per-product result table | Given I am on the detail page for execution `42`, when the page loads, then I see the execution summary (status, started_at, duration, counts) and a table of product rows |
| 6 | As an operator, I want failed rows to show the error message | Given a product failed with message `"HTTP 503"`, when I view its detail row, then the message column shows `"HTTP 503"` |
| 7 | As an operator, I want the detail page to handle an execution with no detail rows | Given an execution has 0 detail rows (e.g., exchange rate scheduler), when the detail page loads, then an empty-state message is shown instead of an empty table |
| 8 | As an operator, I want a back button on the detail page to return to the originating scheduler page | Given I navigated from the ETF scheduler page, when I click back, then I am returned to the ETF scheduler page |

## 5. Technical Design

### Database

New table `task_execution_details`:

```sql
CREATE TABLE task_execution_details (
  id           SERIAL PRIMARY KEY,
  execution_id INTEGER NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  status       TEXT    NOT NULL,   -- 'success' | 'failed' | 'skipped'
  message      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX task_execution_details_execution_idx ON task_execution_details(execution_id);
```

Drizzle schema addition in `src/server/database/schema.ts`:

```typescript
export const taskExecutionDetails = pgTable('task_execution_details', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').notNull().references(() => taskExecutions.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  status: text('status').notNull().$type<'success' | 'failed' | 'skipped'>(),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('task_execution_details_execution_idx').on(t.executionId),
])
```

### Shared Types

New types added to `src/shared/types.ts`:

```typescript
export interface TaskExecutionDetail {
  readonly id: number
  readonly execution_id: number
  readonly product_id: number | null
  readonly product_name: string | null   // joined from products
  readonly product_code: string | null   // joined from products
  readonly status: 'success' | 'failed' | 'skipped'
  readonly message: string | null
  readonly created_at: string
}
```

### Server — Repository

New `TaskExecutionDetailRepository` in `src/server/database/task-execution-detail-repository.ts`:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `create` | `(input: CreateDetailInput): Promise<TaskExecutionDetail>` | Insert one detail row (called by each service per product) |
| `createMany` | `(inputs: readonly CreateDetailInput[]): Promise<void>` | Batch insert for efficiency |
| `findByExecutionId` | `(executionId: number): Promise<readonly TaskExecutionDetail[]>` | Return all rows ordered by id asc, with product join |

`CreateDetailInput`:
```typescript
interface CreateDetailInput {
  readonly executionId: number
  readonly productId: number | null
  readonly status: 'success' | 'failed' | 'skipped'
  readonly message?: string | null
}
```

The `findByExecutionId` query performs a LEFT JOIN on `products` to attach `product_name` and `product_code` without requiring the client to make a separate products lookup.

### Server — Route

Add to the shared executions router mounted at `/api/scheduler`:

```
GET /api/scheduler/executions/:id/details
```

This route is scheduler-type agnostic — the `execution_id` globally identifies the run. The route must:
1. Validate `:id` is a valid integer (400 if not)
2. Verify the execution exists via `TaskExecutionRepository.findById` (404 if not)
3. Return `TaskExecutionDetail[]` from `TaskExecutionDetailRepository.findByExecutionId`

The route is added alongside the existing `DELETE /api/scheduler/executions/:id` in `scheduler.ts`, or extracted into a shared executions router if the pattern warrants it.

### Server — Collector Services

Each of the four collector services gains a reference to `TaskExecutionDetailRepository` and calls `createMany` (or `create` inline) after processing each product batch. Specific integration points:

| Service | File | Detail-write point |
|---------|------|-------------------|
| Price collector | `price-collector-service.ts` | After each product fetch attempt |
| ETF component collector | `etf-component-collector-service.ts` | After each ETF product attempt |
| Holdings price collector | `holdings-price-collector-service.ts` | After each holding price fetch |
| Exchange rate collector | `exchange-rate-collector-service.ts` | After each currency rate fetch (product_id = NULL) |

### Client — Route

New TanStack Router route added in `src/client/src/routes/`:

```
/scheduler/executions/:executionId
```

Lazy-loaded component: `src/client/src/features/scheduler/ExecutionDetailPage.tsx`

The route receives `executionId` as a URL param. The detail page is scheduler-type-agnostic: it displays the execution summary (fetched from the existing status endpoint or passed via router state) and the detail list fetched from the new endpoint.

### Client — API Hook

New hook `src/client/src/features/scheduler/use-execution-detail.ts`:

```typescript
export function useExecutionDetail(executionId: number): {
  readonly details: readonly TaskExecutionDetail[]
  readonly loading: boolean
  readonly error: string | null
}
```

Uses TanStack Query with key `['execution-details', executionId]`.

### Client — ExecutionDetailPage

`src/client/src/features/scheduler/ExecutionDetailPage.tsx` structure:

- Header: back button (navigates to `-1` in history), execution ID, scheduler type label (derived from task name if available)
- Summary card: status badge, started_at, duration, products_total / products_succeeded / products_failed / products_skipped
- Detail table columns: `#` (row index), product name + code, status badge, message
- Empty state when no detail rows exist
- Loading and error states

The `ExecutionRow` component in each existing scheduler page is updated to be clickable (cursor-pointer, `useNavigate`) navigating to `/scheduler/executions/:id`.

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 — Schema & Migration | Add `taskExecutionDetails` to `schema.ts`; run `db:generate` to produce migration; verify migration applies cleanly | Low |
| 2 — Shared Types | Add `TaskExecutionDetail` interface to `src/shared/types.ts`; run `typecheck` | Low |
| 3 — Repository | Implement `TaskExecutionDetailRepository` with `create`, `createMany`, `findByExecutionId`; write unit tests | Medium |
| 4 — Collector Service Integration | Inject `TaskExecutionDetailRepository` into all four collector services; add detail-write calls at product-loop level; update `src/server/scheduler/index.ts` DI wiring; update `src/server/index.ts` if needed | Medium |
| 5 — API Route | Add `GET /api/scheduler/executions/:id/details` route; update `createSchedulerRoutes` signature if needed; share the route across all four scheduler route factories or via a standalone executions router | Low |
| 6 — Client Hook | Implement `use-execution-detail.ts` with TanStack Query | Low |
| 7 — Detail Page UI | Implement `ExecutionDetailPage.tsx`; add TanStack Router route; update `ExecutionRow` components in all four scheduler pages to be clickable | Medium |
| 8 — Tests & Typecheck | Write integration tests for repository and route; run `typecheck` and `vitest run` | Medium |

## 7. Success Metrics

- [ ] After any scheduler execution, `task_execution_details` contains one row per product processed (verified by query after a test run)
- [ ] `GET /api/scheduler/executions/:id/details` returns correct rows with `product_name` and `product_code` populated via JOIN
- [ ] Navigating from an execution row on each of the four scheduler pages reaches the detail page without a 404 or error state
- [ ] Detail page renders the execution summary correctly (status, duration, counts match the parent execution row)
- [ ] Failed rows display their `message` in the detail table
- [ ] An execution with zero detail rows shows the empty state rather than a blank table
- [ ] TypeScript typecheck (`npx tsc --noEmit`) passes with zero errors after implementation
- [ ] All existing scheduler page tests continue to pass (no regression in ExecutionRow behaviour)

## 8. Dependencies

- `task_executions` table (PRD-FEAT-005) — `execution_id` FK target; must exist before migration
- `products` table (PRD-FEAT-004) — `product_id` FK target; nullable to support exchange rate scheduler
- `TaskExecutionRepository` (PRD-FEAT-005) — `findById` used in the detail route for existence check
- All four collector services (PRD-FEAT-005, PRD-FEAT-012, PRD-FEAT-016, PRD-FEAT-017) — must receive new repository via DI
- TanStack Router already wired in the client (`src/client/src/routes/`) — new route must be added to the route tree
- TanStack Query `QueryClientProvider` already configured in `main.tsx` — no setup changes needed
- Drizzle ORM + `drizzle-kit` — `db:generate` and `db:migrate` commands must be run as part of Wave 1

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| High volume of detail rows degrades INSERT performance in large runs (hundreds of products) | Medium — scheduler already runs async; slow inserts extend run duration | Use `createMany` with a single multi-row INSERT (Drizzle `.values([...])`) instead of one INSERT per product |
| Collector service refactoring to inject new repository breaks existing DI wiring | Medium — scheduler startup fails at runtime | Update all four services and `index.ts` DI in Wave 4 atomically; run `typecheck` before merge |
| `product_id` NULL for exchange rate rows causes confusion in the detail table | Low — UI shows "—" for product name/code | Treat NULL product_id as intentional; detail page shows exchange rate currency in the message column instead |
| Existing `ExecutionRow` becoming clickable changes interaction model for users who previously misclicked rows | Low — no destructive action on click | Ensure click target is the whole row and not layered over the delete button; delete button `stopPropagation` on click |
| Migration adds a large table to an existing database causing lock contention in production | Low — `task_execution_details` starts empty; `CREATE TABLE` is non-blocking | Run migration during off-peak hours; the table is brand new so no backfill needed |

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-14 | 1.0 | - | Initial PRD |
