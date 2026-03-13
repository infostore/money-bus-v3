---
type: pdca-plan
plan-name: Scheduler Execution Stop
related-prd: PRD-FEAT-009
phase: check
status: in-progress
created: 2026-03-13
updated: 2026-03-13
tags: [pdca]
---

# PDCA Plan: Scheduler Execution Stop

## Plan

- **Goal**: Allow users to stop a running scheduler execution mid-process

- **Scope**:
  - Add 'aborted' status to shared types
  - Implement AbortController-based soft stop in PriceCollectorService
  - Add POST /stop API route
  - Add client API + hook + UI stop button

- **Success Metrics**:
  - [x] Abort stops after current product finishes (soft stop)
  - [x] Aborted execution recorded with status 'aborted'
  - [x] UI shows stop button only when running
  - [x] 409 returned when no execution is running
  - [x] All tests pass with 80%+ coverage

## Do

- **Tasks**:
  - [x] Wave 1: Add 'aborted' to TaskExecution status union in shared types
  - [x] Wave 2: Rewrite PriceCollectorService with AbortController, abort() method, signal threading
  - [x] Wave 3: Add POST /stop route to scheduler routes
  - [x] Wave 4: Add api.scheduler.stop() + stopMutation in use-scheduler hook
  - [x] Wave 5: Add stop button UI + aborted StatusBadge in SchedulerPage
  - [x] Integration tests for stop route (200 when running, 409 when idle)
  - [x] Unit tests for abort behavior (aborted status, cleanup, safe no-op)

- **Progress Log**:
  - 2026-03-13: Full implementation completed across all 5 waves
  - 2026-03-13: All 263 tests passing, typecheck clean

## Check

- **Results**:
  - 263/263 tests pass (22 unit tests for price-collector-service, 7 integration tests for scheduler routes)
  - TypeScript typecheck clean
  - Abort mechanism uses soft stop — finishes current product before stopping

- **Evidence**:
  - `npx tsc --noEmit` — no errors
  - `npx vitest run` — 263 tests pass

## Act

- **Learnings**:
  1. [Pending completion]

- **Next Actions**:
  1. [Pending completion]
