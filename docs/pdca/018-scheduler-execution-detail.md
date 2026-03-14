---
type: pdca-plan
plan-name: Scheduler Execution Detail
related-prd: PRD-FEAT-018
phase: act
status: completed
created: 2026-03-14
updated: 2026-03-14
tags: [pdca]
---

# PDCA Plan: Scheduler Execution Detail

## Plan

- **Goal**: Introduce per-product execution detail rows for all four scheduler types, a unified REST endpoint to retrieve them, and a shared detail page reachable by clicking any execution row — enabling operators to diagnose partial failures without leaving the browser.

- **Scope**:
  - Wave 1: Drizzle schema addition + migration (`task_execution_details` table)
  - Wave 2: Shared TypeScript types (`TaskExecutionDetail`, `CreateDetailInput`)
  - Wave 3: `TaskExecutionDetailRepository` (create, createMany, findByExecutionId with product JOIN)
  - Wave 4: Collector service integration (inject repository into all four services; write detail rows in product loops)
  - Wave 5: API route (`GET /api/scheduler/executions/:id/details`)
  - Wave 6: Client API hook (`use-execution-detail.ts` with TanStack Query)
  - Wave 7: Detail page UI (`ExecutionDetailPage.tsx`), TanStack Router route, clickable `ExecutionRow` updates across all four scheduler pages
  - Wave 8: Tests + typecheck verification

- **Success Metrics**:
  - [ ] After any scheduler execution, `task_execution_details` contains one row per product processed
  - [ ] `GET /api/scheduler/executions/:id/details` returns correct rows with `product_name` and `product_code` populated via LEFT JOIN
  - [ ] Navigating from an execution row on each of the four scheduler pages reaches the detail page without a 404 or error state
  - [ ] Detail page renders execution summary correctly (status, duration, counts match parent execution row)
  - [ ] Failed rows display their `message` in the detail table
  - [ ] An execution with zero detail rows shows the empty state
  - [ ] `npx tsc --noEmit` passes with zero errors
  - [ ] All existing scheduler page tests continue to pass (no regression in ExecutionRow behaviour)

## Do

- **Tasks**:
  - Wave 1 — Schema & Migration
    - [ ] Add `taskExecutionDetails` pgTable to `src/server/database/schema.ts` with FK to `task_executions` (cascade) and nullable FK to `products` (set null), index on `execution_id` — Low
    - [ ] Run `npm run db:generate` and verify migration file is clean — Low
  - Wave 2 — Shared Types
    - [ ] Add `TaskExecutionDetail` interface and `CreateDetailInput` interface to `src/shared/types.ts` — Low
    - [ ] Run `npx tsc --noEmit` to confirm zero type errors — Low
  - Wave 3 — Repository
    - [ ] Implement `TaskExecutionDetailRepository` class in `src/server/database/task-execution-detail-repository.ts` with `create`, `createMany` (batch INSERT via Drizzle `.values([...])`), and `findByExecutionId` (LEFT JOIN products) — Medium
    - [ ] Write unit tests for repository methods in `tests/` — Medium
  - Wave 4 — Collector Service Integration
    - [ ] Inject `TaskExecutionDetailRepository` into `price-collector-service.ts`; call `createMany` after product batch loop — Medium
    - [ ] Inject into `etf-component-collector-service.ts`; call `createMany` after ETF product loop — Medium
    - [ ] Inject into `holdings-price-collector-service.ts`; call `createMany` after holdings loop — Medium
    - [ ] Inject into `exchange-rate-collector-service.ts`; call `createMany` with `product_id = null` per currency — Medium
    - [ ] Update `src/server/scheduler/index.ts` DI wiring; update `src/server/index.ts` if needed — Low
  - Wave 5 — API Route
    - [ ] Add `GET /api/scheduler/executions/:id/details` to existing scheduler routes in `src/server/routes/scheduler.ts`; validate id, 404 on missing execution, return `TaskExecutionDetail[]` — Low
  - Wave 6 — Client Hook
    - [ ] Implement `use-execution-detail.ts` in `src/client/src/features/scheduler/` using TanStack Query with key `['execution-details', executionId]` — Low
    - [ ] Add `api.scheduler.executionDetails(id)` method to `src/client/src/lib/api/` — Low
  - Wave 7 — Detail Page UI
    - [ ] Implement `ExecutionDetailPage.tsx` with header (back button, execution ID), summary card (status badge, started_at, duration, counts), detail table (#, product name/code, status badge, message), empty state, loading state, error state — Medium
    - [ ] Add TanStack Router route `/scheduler/executions/:executionId` in `src/client/src/routes/` — Low
    - [ ] Update `ExecutionRow` in `SchedulerPage.tsx`, `EtfSchedulerPage.tsx`, `HoldingsPriceSchedulerPage.tsx`, `ExchangeRateSchedulerPage.tsx` to be clickable (cursor-pointer, useNavigate); ensure delete button uses `stopPropagation` — Medium
  - Wave 8 — Tests & Verification
    - [ ] Write integration tests for `GET /api/scheduler/executions/:id/details` route (200, 400, 404 cases) — Medium
    - [ ] Run `npx tsc --noEmit` — confirm zero errors — Low
    - [ ] Run `npx vitest run` — confirm all tests pass including pre-existing scheduler tests — Low

- **Progress Log**:
  - 2026-03-14: PDCA plan created
  - 2026-03-14: Phase transition plan → do (implementation started)
  - 2026-03-14: All 8 waves implemented — schema, types, repository, service integration, API, client hook, detail page, tests fixed
  - 2026-03-14: Phase transition do → check (verification)
  - 2026-03-14: Code review + security review completed; 4 HIGH issues fixed
  - 2026-03-14: Phase transition check → act (completed)

## Check

- **Results**:
  - TypeScript typecheck: zero errors
  - Tests: 418 passed, 32 test files, 0 failures
  - Security review: PASS (0 CRITICAL, 0 HIGH from new code)
  - Code review: 4 HIGH issues found and fixed in follow-up commit

- **Evidence**:
  - `npx tsc --noEmit` — clean
  - `npx vitest run` — 418/418 passed
  - Security review agent: PASS
  - Code review agent: all HIGH issues resolved

## Act

- **Learnings**:
  1. When adding constructor params to services, update all test mock factories immediately
  2. Inline routes in index.ts should always be extracted to route factories for consistency
  3. `useParams({ strict: false })` bypasses TanStack Router type safety — always use `from:` route reference

- **Next Actions**:
  1. Consider extracting the shared ExecutionRow component across all 4 scheduler pages to reduce duplication
  2. Add keyboard accessibility (role="button", tabIndex, onKeyDown) to clickable table rows
