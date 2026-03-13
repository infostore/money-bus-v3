---
type: prd
prd-id: PRD-FEAT-009
prd-type: feature
title: Scheduler Execution Stop (실행 중인 스케줄러 중지)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, scheduler, price-collection, abort, stop]
---

# Feature: Scheduler Execution Stop (실행 중인 스케줄러 중지)

## 1. Overview

가격 수집 스케줄러(`PriceCollectorService`)는 1,806개 종목의 OHLCV 데이터를 순차적으로 수집하며, 실행 시간이 수십 분에 달할 수 있다. 현재는 실행이 시작되면 도중에 중단할 방법이 없다. 잘못된 설정으로 실행이 시작됐거나, 의도치 않게 수동 실행이 트리거된 경우, 또는 개발 중 테스트 실행을 취소해야 할 경우에도 서버를 재시작하거나 완료될 때까지 기다리는 것 외에는 선택지가 없다.

이 기능은 실행 중인 가격 수집 작업을 중지할 수 있는 abort 메커니즘을 추가한다. `PriceCollectorService`에 `AbortController` 기반의 취소 신호를 통합하여 현재 배치 사이 sleep 단계에서 다음 배치 진행을 막고 실행을 정상 종료(`aborted` 상태)한다. 백엔드에는 `POST /api/scheduler/price-collection/stop` 엔드포인트를 추가하고, 프론트엔드의 `SchedulerPage`에는 실행 중일 때만 활성화되는 중지 버튼을 추가한다.

abort는 현재 처리 중인 개별 종목(product)까지는 완료를 보장한 뒤 다음 배치로 진행하지 않는 "soft stop" 방식으로 동작한다. 이를 통해 이미 수집된 데이터는 유지되고, DB 상태는 항상 일관성이 보장된다.

---

## 2. User Stories

- As a developer, I want to stop a running price collection so that I can cancel an accidental or unwanted execution without restarting the server.
- As a developer, I want the stop to complete cleanly so that already-collected price data is preserved and the database remains consistent.
- As a developer, I want the UI to show a stop button when the scheduler is running so that I can trigger the stop without using the API directly.
- As a developer, I want the stopped execution to be recorded with an `aborted` status so that I can distinguish intentional stops from failures in the history.

---

## 3. Scope

### In Scope

- `POST /api/scheduler/price-collection/stop` API endpoint
- `PriceCollectorService`: add `AbortController`-based abort mechanism; check abort signal between batches and between products within a batch
- `TaskExecution.status` extended with `'aborted'` value in shared types
- `task_executions` table: `status` column now accepts `'aborted'` (no schema migration required — column is `text`)
- `useScheduler` hook: add `stopRun(): Promise<void>` action and `stopError: string | null`
- `SchedulerPage`: add a stop button (visible and enabled only when `isRunning === true`; disabled while stop is in-flight)
- `StatusBadge`: add `aborted` status display (icon + label + color)
- `api.scheduler.stop()` in `src/client/src/lib/api.ts`
- Server-side guard: `POST /stop` returns `409 Conflict` when no execution is currently running

### Out of Scope

- Hard kill of the currently-processing individual product (mid-product interruption is not safe)
- Aborting the cron-triggered daily execution differently from manual execution (same abort path)
- UI for configuring or disabling the scheduled cron (future admin panel PRD)
- Pause / resume functionality (stop is permanent for the current run)
- Multi-process abort signaling (in-memory `AbortController` is sufficient for single-process deployment)

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Stop a running execution via API | Given `PriceCollectorService.running === true`, when `POST /api/scheduler/price-collection/stop` is called, then the abort signal is triggered, the service stops after the current product finishes, and the execution is finalized with `status = 'aborted'`. Response is `200 { success: true, data: null, error: null }`. |
| 2 | Stop when not running returns 409 | Given no execution is currently running (`service.running === false`), when `POST /api/scheduler/price-collection/stop` is called, then the server returns `409 Conflict` with `{ success: false, data: null, error: 'No execution is currently running' }`. |
| 3 | Abort preserves completed data | Given an execution was aborted mid-run (e.g., after processing 200 of 1806 products), then the `price_history` rows already upserted are retained. The `task_executions` row reflects the actual `products_succeeded`, `products_failed`, and `products_skipped` counts at the time of abort. |
| 4 | Aborted execution marked correctly | Given an execution is aborted, when it finalizes, then `task_executions.status = 'aborted'`, `finished_at` is set, and `message = 'Execution stopped by user'`. The existing 10-record trim runs as normal after abort. |
| 5 | Stop button in UI | Given `isRunning === true` in `SchedulerPage`, then a stop button is rendered next to the existing "수동 실행" button. The stop button is disabled when the stop request is in-flight (shows spinner). |
| 6 | Stop button hidden when idle | Given `isRunning === false`, then no stop button is rendered (or it is visually suppressed). The "수동 실행" button is the only action visible in idle state. |
| 7 | Aborted status in execution history | Given an `aborted` execution row is displayed in the history table, then `StatusBadge` renders it with a distinct icon and label ("중지됨"). The row can be deleted using the existing delete button (PRD-FEAT-008). |
| 8 | Stop error feedback | Given the `POST /stop` API returns a non-2xx response or network error, then an error message is displayed in the existing error banner in `SchedulerPage`. |

---

## 5. Technical Design

### Architecture

```
SchedulerPage
  └─ stop button → useScheduler.stopRun()
       └─ api.scheduler.stop()  [POST /api/scheduler/price-collection/stop]
            └─ createSchedulerRoutes → PriceCollectorService.abort()
                 └─ AbortController.abort()
                      └─ PriceCollectorService (between-batch check)
                           └─ finalize execution with status='aborted'
```

### Abort Mechanism in `PriceCollectorService`

The service holds a private `abortController: AbortController | null` field alongside the existing `isRunning` flag. On each call to `run()`, a new `AbortController` is created and stored. An `abort()` method exposes the signal trigger externally.

Abort is checked at two points in the processing loop:
1. **Between batches**: after the inter-batch `sleep()`, before starting the next batch
2. **Between products within a batch**: after each individual product is processed

When the signal is detected, `processProducts` throws or returns early, and `executeCollection` catches this to finalize the execution with `status = 'aborted'`.

```typescript
// Additions to PriceCollectorService
private abortController: AbortController | null = null

abort(): void {
  this.abortController?.abort()
}

// Modified run() — creates AbortController for the lifetime of this run
async run(): Promise<TaskExecution> {
  if (this.isRunning) {
    throw new Error('Collection is already running')
  }
  this.abortController = new AbortController()
  this.isRunning = true
  try {
    return await this.executeCollection(this.abortController.signal)
  } finally {
    this.isRunning = false
    this.abortController = null
  }
}

// executeCollection receives signal and passes to processProducts
private async executeCollection(signal: AbortSignal): Promise<TaskExecution>

// processProducts checks signal between batches and between products
private async processProducts(
  executionId: number,
  products: readonly Product[],
  fetchFn: AdapterFetchFn,
  batchSize: number,
  delayMs: number,
  counters: CollectionCounters,
  signal: AbortSignal,
): Promise<void>
```

When `signal.aborted` is `true`:
- `processProducts` returns immediately (no further batches processed)
- `executeCollection` finalizes with `status = 'aborted'` and `message = 'Execution stopped by user'`

### `TaskExecution` Status Extension

The `status` field in `TaskExecution` (shared type) is extended to include `'aborted'`:

```typescript
// src/shared/types.ts — existing TaskExecution interface
export interface TaskExecution {
  // ...
  readonly status: 'running' | 'success' | 'partial' | 'failed' | 'aborted'
  // ...
}
```

No database migration is required — the `status` column is `text` type and already accepts arbitrary string values.

### API Endpoint

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| POST | `/api/scheduler/price-collection/stop` | Abort the running execution | `200` `{ success: true, data: null, error: null }` or `409` if not running |

Route handler in `src/server/routes/scheduler.ts`:

```typescript
app.post('/stop', async (c) => {
  if (!service.running) {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'No execution is currently running' },
      409,
    )
  }

  service.abort()
  return c.json<ApiResponse<null>>({ success: true, data: null, error: null })
})
```

### Shared Types (`src/shared/types.ts`)

Only the `status` union in `TaskExecution` needs to be updated — no new interfaces are required.

### API Client (`src/client/src/lib/api.ts`)

Add `stop` to the `scheduler` namespace:

```typescript
scheduler: {
  // ...existing methods...
  stop: () => request<null>('/scheduler/price-collection/stop', { method: 'POST' }),
}
```

### Hook Changes (`use-scheduler.ts`)

Add `stopMutation` and expose `stopRun` / `stopError`:

```typescript
const stopMutation = useMutation({
  mutationFn: () => api.scheduler.stop(),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: SCHEDULER_KEY }),
})

// Return additions:
stopRun: async () => {
  await stopMutation.mutateAsync()
},
isStopping: stopMutation.isPending,
stopError: stopMutation.error instanceof Error ? stopMutation.error.message : null,
```

### Component Changes (`SchedulerPage.tsx`)

Add a stop button in the header action area, adjacent to the existing "수동 실행" button. The button renders only when `isRunning === true`:

```typescript
{isRunning && (
  <Button
    variant="secondary"
    onClick={() => stopRun()}
    disabled={isStopping}
    className="gap-1.5"
  >
    {isStopping ? (
      <>
        <Loader2 size={16} className="animate-spin" />
        중지 중...
      </>
    ) : (
      <>
        <Square size={16} />
        중지
      </>
    )}
  </Button>
)}
```

`StatusBadge` adds the `aborted` case to `STATUS_CONFIG`:

```typescript
aborted: { label: '중지됨', icon: Square, className: 'text-surface-400' },
```

Wire `stopError` into the existing error banner alongside `error`, `runError`, and `deleteError`.

### File Structure (changes only)

```
src/server/
  scheduler/
    price-collector-service.ts   # + abort(), abortController field, signal threading
  routes/
    scheduler.ts                 # + POST /stop handler

src/client/src/
  lib/
    api.ts                       # + scheduler.stop()
  features/scheduler/
    use-scheduler.ts             # + stopRun(), isStopping, stopError
    SchedulerPage.tsx            # + stop button, aborted StatusBadge config
src/shared/
  types.ts                       # + 'aborted' to TaskExecution.status union
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Shared types: add `'aborted'` to `TaskExecution.status` union in `src/shared/types.ts`. | Low |
| 2 | Unit tests (RED): `PriceCollectorService.abort()` triggers abort signal; `processProducts` stops after current product when signal is aborted; execution is finalized with `status = 'aborted'` and correct counts. Then implement abort mechanism in `PriceCollectorService` (GREEN). | Medium |
| 3 | Route tests (RED): `POST /stop` returns `200` when running, `409` when idle. Then implement route handler in `scheduler.ts` (GREEN). | Low |
| 4 | API client: add `scheduler.stop()` to `api.ts`. Hook: add `stopMutation`, expose `stopRun`, `isStopping`, `stopError` in `useScheduler`. Write hook unit tests. | Low |
| 5 | UI: add stop button to `SchedulerPage` header (visible only when `isRunning`); add `aborted` entry to `STATUS_CONFIG` in `StatusBadge`; wire `stopError` into error banner. | Low |

Note: Follows mandatory TDD workflow — tests written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] `POST /api/scheduler/price-collection/stop` returns `200` and triggers abort when an execution is running
- [ ] `POST /api/scheduler/price-collection/stop` returns `409` with `error: 'No execution is currently running'` when idle
- [ ] Aborted execution is finalized with `status = 'aborted'`, `finished_at` set, and `message = 'Execution stopped by user'`
- [ ] `products_succeeded`, `products_failed`, and `products_skipped` counts in the aborted execution reflect work done up to the abort point
- [ ] Price rows already upserted before abort are retained in `price_history` (no rollback)
- [ ] A new `run()` call succeeds immediately after a previous execution was aborted (no stuck `isRunning` flag)
- [ ] Stop button is visible in `SchedulerPage` only when `isRunning === true`
- [ ] Stop button is disabled and shows spinner while the stop request is in-flight
- [ ] `StatusBadge` renders `aborted` rows with "중지됨" label and distinct icon
- [ ] `stopError` surfaces in the existing error banner on stop API failure
- [ ] `aborted` execution rows can be deleted using the existing delete button (PRD-FEAT-008)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit` passes)
- [ ] Tests achieve 80%+ coverage for `PriceCollectorService` abort path and the new route handler

---

## 8. Dependencies

- PRD-FEAT-005 (Price History Scheduler) — `PriceCollectorService`, `task_executions` table, and `/api/scheduler/*` routes are the base this feature extends
- PRD-FEAT-008 (Scheduler Execution History Delete) — `aborted` rows must be deletable via the existing delete flow; `StatusBadge` needs to handle the new status
- No new npm packages required (`AbortController` is available in Node.js 15+ and all modern browsers)
- No database migration required (`status` column is `text` type)

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Abort signal checked between batches, not mid-product — long-running individual API calls are not interrupted | Low | Single product fetch typically completes in < 3 seconds. The soft-stop approach is acceptable; hard kill is unsafe for DB consistency. Document this behavior clearly. |
| Race condition: `service.running` is `true` but abort is triggered just before `isRunning = false` is set in the `finally` block | Low | The abort sets `abortController.abort()` before the execution finalize path; the signal is checked before each batch and product. The finally block always clears `isRunning`, so the service is never stuck. |
| `aborted` status not handled in existing UI components that read `TaskExecution.status` | Medium | `STATUS_CONFIG` in `SchedulerPage` and all `switch`/`if` blocks on `status` must include `'aborted'`. TypeScript exhaustive checks will surface missed cases at compile time. |
| In-memory `AbortController` does not survive a server restart | Low | After a server restart, `PriceCollectorService` has no running execution; the existing stale-run recovery (PRD-FEAT-005) marks any `running` DB rows as `failed`. Acceptable trade-off for single-process deployment. |
| User clicks stop multiple times rapidly before the first request resolves | Low | `isStopping` disables the button during in-flight request. The `abort()` method is idempotent (calling `AbortController.abort()` multiple times is a no-op after the first call). |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for scheduler execution stop feature |
