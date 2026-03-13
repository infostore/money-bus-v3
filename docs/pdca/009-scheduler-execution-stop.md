---
type: pdca-plan
plan-name: Scheduler Execution Stop
related-prd: PRD-FEAT-009
phase: check
status: in-progress
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, scheduler, abort, timeout]
---

# PDCA Plan: Scheduler Execution Stop

## v1.0 — Abort Mechanism (Completed)

- [x] Wave 1: Add 'aborted' to TaskExecution status union in shared types
- [x] Wave 2: Rewrite PriceCollectorService with AbortController, abort() method, signal threading
- [x] Wave 3: Add POST /stop route to scheduler routes
- [x] Wave 4: Add api.scheduler.stop() + stopMutation in use-scheduler hook
- [x] Wave 5: Add stop button UI + aborted StatusBadge in SchedulerPage
- 263 tests passing, typecheck clean

---

## v1.1 — Fetch Timeout & Abort Signal Propagation

## Plan

- **Goal**: Fix scheduler hanging on unresponsive upstream APIs by threading AbortSignal through the entire fetch chain and adding per-request timeouts.

- **Scope**:
  - `withRetry`: accept `{ signal }` option, bail immediately on abort
  - `NaverFinanceAdapter`: pass `AbortSignal` + 30s timeout to `fetch()`
  - `YahooFinanceAdapter`: pass `AbortSignal` + 30s timeout to `yahoo-finance2`
  - `PriceCollectorService`: thread signal through `processOneProduct` → `withRetry` → adapter
  - `EtfComponentCollectorService`: apply same pattern if applicable

- **Success Metrics**:
  - [ ] `withRetry` stops retrying immediately when abort signal fires
  - [ ] Naver adapter fetch respects abort signal and 30s timeout
  - [ ] Yahoo adapter fetch respects abort signal and 30s timeout
  - [ ] After POST /stop, execution finalizes within ~30s (worst case: one timeout)
  - [ ] All existing tests still pass
  - [ ] New tests achieve 80%+ coverage for abort/timeout paths

## Do

- **Tasks**:

  ### Wave 6: `withRetry` abort support (TDD)
  - [x] RED: Test `withRetry` bails immediately when signal is already aborted
  - [x] RED: Test `withRetry` stops retrying when signal fires mid-retry
  - [x] GREEN: Update `withRetry` to accept `{ signal }` options, check `signal.aborted` before each attempt
  - [x] REFACTOR: Keep backward-compatible (signal is optional)

  ### Wave 7: Adapter timeout & abort (TDD)
  - [x] RED: Test `NaverFinanceAdapter.fetchPrices` aborts on signal, times out after 30s
  - [x] GREEN: Add `signal` param to `NaverFinanceAdapter.fetchPrices`, use `AbortSignal.any([signal, AbortSignal.timeout(30_000)])`
  - [x] RED: Test `YahooFinanceAdapter.fetchPrices` aborts on signal, times out after 30s
  - [x] GREEN: Add `signal` param to `YahooFinanceAdapter.fetchPrices`, wrap with timeout

  ### Wave 8: Service signal threading
  - [x] Update `AdapterFetchFn` type to include `signal?: AbortSignal`
  - [x] Thread signal from `processOneProduct` → `withRetry({ signal })` → `fetchFn(product, range, signal)`
  - [x] Update existing PriceCollectorService tests to verify signal propagation
  - [x] Apply same pattern to `EtfComponentCollectorService`

- **Progress Log**:
  - 2026-03-13: v1.1 PDCA plan created for fetch timeout & abort signal propagation
  - 2026-03-13: All waves (6-8) implemented via TDD. 365 tests passing, typecheck clean.

## Check

- **Results**:
  - 365/365 tests pass (28 test files), up from 358 (7 new abort/timeout tests)
  - TypeScript typecheck clean (`npx tsc --noEmit`)
  - `withRetry` now supports `{ signal }` options (backward-compatible with positional args)
  - Naver adapter: `AbortSignal.any([signal, AbortSignal.timeout(30s)])` on every fetch
  - Yahoo adapter: `Promise.race` with timeout + abort signal check after fetch
  - Both PriceCollectorService and EtfComponentCollectorService thread signal through full chain

- **Evidence**:
  - `npx tsc --noEmit` — no errors
  - `npx vitest run` — 365 tests pass

## Act

- **Learnings**:
  1. [Pending completion]

- **Next Actions**:
  1. [Pending completion]
