---
type: prd
prd-id: PRD-FEAT-008
prd-type: feature
title: Scheduler Execution History Delete (실행 이력 삭제)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, scheduler, task-execution, delete]
---

# Feature: Scheduler Execution History Delete (실행 이력 삭제)

## 1. Overview

`/scheduler/price-collection` 페이지에는 최근 10건의 실행 이력이 표시된다. 현재 이 이력 레코드는 자동 trim(10건 초과 시 오래된 것 삭제)으로만 관리되며, 사용자가 특정 이력을 직접 삭제할 수 있는 방법이 없다. 테스트 실행 결과, 오류 메시지가 포함된 실패 이력, 또는 불필요한 과거 기록이 화면에 남아 있어 노이즈가 된다.

이 기능은 `task_executions` 테이블에서 개별 실행 이력 레코드를 수동으로 삭제하는 기능을 추가한다. 삭제 대상은 완료된 이력(`success`, `partial`, `failed` 상태)으로 한정하며, 현재 실행 중(`running`)인 레코드는 삭제할 수 없다. 삭제 동작은 UI에서 각 행의 삭제 버튼으로 트리거되며, 확인 다이얼로그 없이 즉시 삭제된다(이력 데이터이므로 낮은 위험도).

백엔드에는 `DELETE /api/scheduler/price-collection/executions/:id` 엔드포인트를 추가하고, `TaskExecutionRepository`에 `delete(id)` 메서드를 추가한다. 프론트엔드에는 `useScheduler` 훅에 `deleteExecution` 액션을 추가하고, `SchedulerPage`의 `ExecutionRow` 컴포넌트에 삭제 버튼을 렌더링한다.

---

## 2. User Stories

- As a developer, I want to delete individual completed execution history records so that I can keep the scheduler history clean and free of noise.
- As a developer, I want running executions to be protected from deletion so that I do not accidentally interrupt an active collection.
- As a developer, I want deleted records to disappear from the UI immediately so that I get instant feedback on my action.

---

## 3. Scope

### In Scope

- `DELETE /api/scheduler/price-collection/executions/:id` API endpoint
- Server-side guard: returns `409 Conflict` if the targeted execution has `status = 'running'`
- Server-side guard: returns `404 Not Found` if the execution record does not exist
- `TaskExecutionRepository.delete(id)` method: deletes by PK, returns `boolean`
- `TaskExecutionRepository.findById(id)` method: looks up single record to check status before delete
- `useScheduler` hook: adds `deleteExecution(id: number): Promise<void>` action
- `ExecutionRow` component: adds a delete icon button, visible only when `status !== 'running'`
- `SchedulerPage`: wires `deleteExecution` into `ExecutionRow` props
- Optimistic UI is NOT used — query invalidation after confirmed delete is sufficient
- Tests: repository unit tests, route integration tests, hook unit tests

### Out of Scope

- Bulk delete (select multiple records and delete at once)
- Confirmation modal or undo mechanism
- Delete protection for `success` records (all non-running records can be deleted)
- Scheduled auto-cleanup policy changes (the existing 10-record trim is unchanged)
- Deletion of `price_history` rows related to the execution

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Delete a completed execution record | Given an execution with status `success`, `partial`, or `failed`, when the user clicks the delete button in its row, then `DELETE /api/scheduler/price-collection/executions/:id` is called and the record is removed from the database. The UI re-fetches and the row disappears. Response is `200 { success: true, data: null, error: null }`. |
| 2 | Block deletion of running execution | Given an execution with `status = 'running'`, when `DELETE /api/scheduler/price-collection/executions/:id` is called, then the server returns `409 Conflict` with `{ success: false, data: null, error: 'Cannot delete a running execution' }`. The record is not deleted. |
| 3 | Handle non-existent record | Given an execution ID that does not exist in the database, when `DELETE /api/scheduler/price-collection/executions/:id` is called, then the server returns `404 Not Found` with `{ success: false, data: null, error: 'Execution not found' }`. |
| 4 | Delete button hidden for running row | Given an execution row with `status = 'running'` is rendered in the table, then no delete button is shown for that row. The button is only rendered for `success`, `partial`, and `failed` rows. |
| 5 | Delete button shows loading state | Given the delete request is in-flight, then the delete button in that row shows a spinner and is disabled to prevent duplicate requests. Other rows are unaffected. |
| 6 | Error feedback on delete failure | Given the delete API call returns a non-2xx response or a network error, then an error message is displayed (using the existing error banner pattern in `SchedulerPage`) and the row remains in the list. |

---

## 5. Technical Design

### Architecture

```
SchedulerPage
  └─ ExecutionRow (per row)
       └─ delete button → useScheduler.deleteExecution(id)
            └─ api.scheduler.deleteExecution(id)  [DELETE /api/scheduler/price-collection/executions/:id]
                 └─ createSchedulerRoutes → TaskExecutionRepository.findById + delete
```

### API Endpoint

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| DELETE | `/api/scheduler/price-collection/executions/:id` | Delete a single execution record | `200` `{ success: true, data: null, error: null }` or `404`/`409` on error |

### Repository Changes (`task-execution-repository.ts`)

Add two methods to `TaskExecutionRepository`:

```typescript
// Find single execution by PK (needed for status check before delete)
async findById(id: number): Promise<TaskExecution | undefined>

// Delete by PK; returns true if a row was deleted, false if not found
async delete(id: number): Promise<boolean>
```

The route handler uses `findById` to check status, then calls `delete`. The repository layer does not enforce the business rule — the route is responsible for the guard.

### Route Handler (`src/server/routes/scheduler.ts`)

```typescript
app.delete('/executions/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'Invalid execution id' },
      400,
    )
  }

  const execution = await executionRepo.findById(id)
  if (!execution) {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'Execution not found' },
      404,
    )
  }
  if (execution.status === 'running') {
    return c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'Cannot delete a running execution' },
      409,
    )
  }

  await executionRepo.delete(id)
  return c.json<ApiResponse<null>>({ success: true, data: null, error: null })
})
```

### Shared Types (`src/shared/types.ts`)

No new types needed. The existing `TaskExecution` and `ApiResponse<T>` interfaces cover all new endpoints.

### API Client Changes (`src/client/src/lib/api.ts`)

Add `deleteExecution` to the `scheduler` namespace:

```typescript
scheduler: {
  // ...existing methods...
  deleteExecution: (id: number) =>
    request<null>(`/scheduler/price-collection/executions/${id}`, {
      method: 'DELETE',
    }),
}
```

### Hook Changes (`use-scheduler.ts`)

Add `deleteExecution` mutation using the existing `useMutation` + `invalidateQueries` pattern:

```typescript
const deleteMutation = useMutation({
  mutationFn: (id: number) => api.scheduler.deleteExecution(id),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: SCHEDULER_KEY }),
})

// Expose in return:
deleteExecution: async (id: number) => {
  await deleteMutation.mutateAsync(id)
},
deleteError: deleteMutation.error instanceof Error ? deleteMutation.error.message : null,
```

### Component Changes (`SchedulerPage.tsx`)

Extend `ExecutionRowProps` to accept `onDelete`:

```typescript
interface ExecutionRowProps {
  readonly execution: TaskExecution
  readonly onDelete: (id: number) => Promise<void>
  readonly isDeleting: boolean
}
```

Inside `ExecutionRow`, render the delete button conditionally:

```typescript
{execution.status !== 'running' && (
  <button
    onClick={() => onDelete(execution.id)}
    disabled={isDeleting}
    aria-label="이력 삭제"
    className="..."
  >
    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
  </button>
)}
```

Per-row deleting state is tracked in `SchedulerPage` via a `deletingId: number | null` state variable, set before calling `deleteExecution` and cleared after resolution.

### File Structure (changes only)

```
src/server/
  database/
    task-execution-repository.ts   # + findById(), delete()
  routes/
    scheduler.ts                   # + DELETE /executions/:id handler

src/client/src/
  lib/
    api.ts                         # + scheduler.deleteExecution()
  features/scheduler/
    use-scheduler.ts               # + deleteExecution(), deleteError
    SchedulerPage.tsx              # + delete button in ExecutionRow
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Repository tests (RED): `findById` returns correct record or `undefined`; `delete` returns `true` on success and `false` for missing ID. Then implement `findById` and `delete` in `TaskExecutionRepository` (GREEN). | Low |
| 2 | Route tests (RED): `DELETE /executions/:id` returns `200` for completed record, `404` for missing, `409` for running status, `400` for non-numeric id. Then implement the route handler in `scheduler.ts` (GREEN). | Low |
| 3 | Hook and API client: add `deleteExecution` to `api.scheduler`, add `deleteExecution` mutation + `deleteError` to `useScheduler`. Write hook unit tests (mock API, verify `invalidateQueries` called on success). | Low |
| 4 | UI: extend `ExecutionRowProps` with `onDelete` + `isDeleting`; add `Trash2` delete button (hidden for `running` rows); track `deletingId` state in `SchedulerPage`; wire `deleteError` into existing error banner. | Low |

Note: Follows mandatory TDD workflow — tests written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] `DELETE /api/scheduler/price-collection/executions/:id` returns `200` and removes the row from `task_executions` for a completed execution
- [ ] The endpoint returns `409` when the targeted execution has `status = 'running'` and leaves the row intact
- [ ] The endpoint returns `404` when the given `id` does not exist in the database
- [ ] The endpoint returns `400` for a non-numeric `:id` path parameter
- [ ] No delete button is rendered for rows with `status = 'running'` in the UI
- [ ] The delete button shows a spinner and is disabled while the delete request is in-flight
- [ ] After a successful delete, the execution row disappears from the list (query invalidation triggers re-fetch)
- [ ] A delete failure surfaces an error message in the existing error banner (no silent failures)
- [ ] Tests achieve 80%+ coverage for the new repository methods, route handler, and hook changes
- [ ] TypeScript compiles without errors (`npx tsc --noEmit` passes)

---

## 8. Dependencies

- PRD-FEAT-005 (Price History Scheduler) — `task_executions` table and `TaskExecutionRepository` already exist; this PRD extends them without schema changes
- No new npm packages required
- No database migration needed (no schema changes)

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Race condition: execution transitions from `running` to `success` between status check and delete | Low | The check-then-delete is not atomic, but the window is tiny and the consequence is a failed delete (409). Acceptable for a developer-facing admin page. |
| Deleting an execution that was the last record leaves history empty, confusing users | Low | Empty state is already handled in `SchedulerPage` ("실행 이력이 없습니다"). No additional work needed. |
| `deletingId` state in `SchedulerPage` becomes stale if the component unmounts during delete | Low | `useMutation` handles unmounted component gracefully; state update after unmount is a no-op in React 18. |
| Accidental deletion of useful success records (no confirmation modal) | Low | Targets a developer-only admin page. Records can be re-created by running the scheduler again. Decision: no confirmation needed. |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for scheduler execution history delete |
