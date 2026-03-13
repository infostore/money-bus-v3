---
type: pdca-plan
plan-name: ETF Component Collection Scheduler
related-prd: PRD-FEAT-012
phase: act
status: completed
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, scheduler, etf, components, samsung, timefolio, rise, batch]
---

# PDCA Plan: ETF Component Collection Scheduler

## Plan

- **Goal**: Implement a backend scheduler that collects ETF constituent holdings data (구성종목) from Samsung Active (XLS), TIMEFOLIO (HTML), and RISE (HTML) fund manager sources on a daily cron schedule, stores snapshots in PostgreSQL via Drizzle ORM, and exposes manual trigger, stop, status, and query APIs — reusing the existing price scheduler infrastructure.

- **Scope**:
  - Wave 0: npm dependency installation (`exceljs`, `cheerio`)
  - Wave 1: Drizzle schema additions (`etf_profiles`, `etf_components`) + migration + shared types (`EtfManager`, `EtfProfile`, `EtfComponent`, `CreateEtfComponentPayload`)
  - Wave 2: Repository layer (TDD) — `EtfProfileRepository` and `EtfComponentRepository`
  - Wave 3: Adapter interface + `SamsungActiveAdapter` (XLS via `exceljs`)
  - Wave 4: `TimefolioAdapter` (HTML via `cheerio`)
  - Wave 5: `RiseAdapter` (HTML via `cheerio`)
  - Wave 6: `EtfComponentCollectorService` — chunked orchestration, abort support, execution logging
  - Wave 7: Hono routes + `startSchedulers` update + server `index.ts` wiring + ETF profile seed
  - Wave 8: Real-URL population in `ETF_PROFILE_SEEDS` + end-to-end verification

- **Success Metrics**:
  - [ ] `etf_profiles` rows are seeded idempotently on server startup for all entries in `ETF_PROFILE_SEEDS`
  - [ ] `etf_components` receives rows for all seeded ETFs after one full scheduler run
  - [ ] No duplicate rows: upsert on `(etf_product_id, component_symbol, snapshot_date)` unique constraint prevents duplicates
  - [ ] Snapshot-existence check: if rows already exist for `(etf_product_id, today)`, the ETF is skipped without making HTTP requests
  - [ ] Samsung Active XLS adapter correctly parses XLS buffer into component rows (symbol, name, weight, shares)
  - [ ] TIMEFOLIO HTML adapter correctly parses constituent table from fund manager page
  - [ ] RISE HTML adapter correctly parses constituent table from fund manager page
  - [ ] ETFs are processed in chunks of 5 with 500ms delay between chunks
  - [ ] Per-ETF failure does not abort the full run; remaining ETFs continue processing
  - [ ] `withRetry` applied per-ETF adapter call (maxRetries=2, baseDelayMs=1000)
  - [ ] `POST /api/scheduler/etf-components/run` returns `202` when idle, `409` when already running
  - [ ] `POST /api/scheduler/etf-components/stop` aborts the run; execution record is marked `aborted`
  - [ ] `GET /api/scheduler/etf-components/status` returns last 10 execution records sorted by `started_at` DESC
  - [ ] `GET /api/etf-components?productId=X&snapshotDate=Y` returns component rows sorted by `weight` DESC
  - [ ] `GET /api/etf-components/dates?productId=X` returns distinct snapshot dates sorted DESC
  - [ ] `task_executions` table retains at most 10 rows per task after each run
  - [ ] Tests achieve 80%+ coverage for scheduler and repository modules

## Do

- **Tasks**:

  ### Wave 0 — Dependencies
  - [ ] Install `exceljs` and `cheerio` npm packages; verify TypeScript types available — Low

  ### Wave 1 — Foundation: Schema + Types
  - [ ] Add `index` to existing `drizzle-orm/pg-core` import in `schema.ts`; add `etf_profiles` and `etf_components` table definitions — Low
  - [ ] Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`) — Low
  - [ ] Add shared types (`EtfManager`, `EtfProfile`, `EtfComponent`, `CreateEtfComponentPayload`) to `src/shared/types.ts` — Low
  - [ ] Run `npx tsc --noEmit` to verify no import errors — Low

  ### Wave 2 — Repository Layer (TDD)
  - [ ] Write RED tests for `EtfProfileRepository`: `findAll`, `findByProductId`, `seedProfiles` (ON CONFLICT DO NOTHING, unknown-manager warning, missing product skip) — Medium
  - [ ] Implement `EtfProfileRepository` to pass tests (GREEN) — Medium
  - [ ] Write RED tests for `EtfComponentRepository`: `upsertMany`, `findByProductAndDate` (weight DESC sort), `findDatesByProduct` (distinct DESC), `hasSnapshot` — Medium
  - [ ] Implement `EtfComponentRepository` to pass tests (GREEN) — Medium

  ### Wave 3 — SamsungActiveAdapter (TDD)
  - [ ] Define `EtfComponentAdapter` interface and `EtfComponentRow` type in `etf-component-adapter.ts` — Low
  - [ ] Create XLS fixture at `tests/fixtures/samsung-active-holdings.xlsx` — Low
  - [ ] Write RED tests for `SamsungActiveAdapter`: parse fixture rows (`종목코드`, `종목명`, `비중(%)`, `보유수량`), empty-sheet handling — Medium
  - [ ] Implement `SamsungActiveAdapter` using `exceljs` (GREEN) — Medium

  ### Wave 4 — TimefolioAdapter (TDD)
  - [ ] Create HTML fixture at `tests/fixtures/timefolio-holdings.html` — Low
  - [ ] Write RED tests for `TimefolioAdapter`: parse constituent table, empty-table handling — Medium
  - [ ] Implement `TimefolioAdapter` using `cheerio` (GREEN) — Medium

  ### Wave 5 — RiseAdapter (TDD)
  - [ ] Create HTML fixture at `tests/fixtures/rise-holdings.html` — Low
  - [ ] Write RED tests for `RiseAdapter`: parse RISE-specific table structure, empty-table handling — Medium
  - [ ] Implement `RiseAdapter` using `cheerio` (GREEN) — Medium

  ### Wave 6 — EtfComponentCollectorService (TDD)
  - [ ] Write RED tests for `EtfComponentCollectorService`: chunk iteration (5-ETF chunks, 500ms delay), adapter resolution, snapshot-existence skip, per-ETF error isolation, abort signal handling, execution logging — High
  - [ ] Implement `EtfComponentCollectorService` in `src/server/scheduler/etf-component-collector-service.ts` (GREEN) — High

  ### Wave 7 — Integration + API
  - [ ] Create `src/server/scheduler/etf-profile-seed.ts` with `EtfProfileSeedEntry`, `VALID_MANAGERS`, and placeholder `ETF_PROFILE_SEEDS` entries — Low
  - [ ] Implement Hono routes `src/server/routes/etf-component-scheduler.ts`: `POST /run` (202/409), `POST /stop` (200/409), `GET /status` — Low
  - [ ] Implement Hono routes `src/server/routes/etf-components.ts`: `GET /` (productId + snapshotDate required, 400 on missing/invalid), `GET /dates` (productId required) — Low
  - [ ] Update `startSchedulers` signature in `src/server/scheduler/index.ts`: rename `service` → `priceService`, add `etfService`; update cron dispatch to route by `task.name` — Medium
  - [ ] Wire server `src/server/index.ts`: seed `etf-component-collection-daily` task row (`enabled: false`), query taskId, construct `EtfComponentCollectorService`, pass to `startSchedulers`, register new routes — Medium
  - [ ] Run `npx tsc --noEmit` to verify full compilation — Low

  ### Wave 8 — Real-URL Verification
  - [ ] Populate `ETF_PROFILE_SEEDS` with real download URLs for Samsung Active, TIMEFOLIO, RISE ETFs present in `products` table — Medium
  - [ ] Call `POST /api/scheduler/etf-components/run` and verify at least one `etf_components` row is created in DB — Low
  - [ ] Enable cron task via DB update after successful verification — Low

- **Progress Log**:
  - 2026-03-13: PDCA plan created. Implementation not started.
  - 2026-03-13: Waves 0-7 complete. All 347 tests passing (28 test files). Wave 8 (real URLs + verification) pending.
  - 2026-03-13: Code review passed. PR #36 squash-merged to main. PDCA completed.

## Check

- **Results**:
  - Waves 0-7 implemented successfully. All 347 tests passing across 28 test files.
  - Coverage: 86.82% statements, 85.18% branches, 91.53% functions — exceeds 80% threshold.
  - TypeScript compilation clean (`npx tsc --noEmit` passes).
  - Code review: 0 CRITICAL, 0 HIGH (3 HIGH found and fixed during review), 3 MEDIUM (acceptable).
  - Wave 8 (real URL population) deferred to future work — requires real fund manager download URLs.

- **Evidence**:
  - PR #36 merged to main via squash merge (2026-03-13)
  - 33 new tests added across 6 test files (2 integration, 4 unit)
  - All adapters (Samsung XLS, TIMEFOLIO HTML, RISE HTML) verified via fixture-based unit tests

## Act

- **Learnings**:
  1. Adapter pattern with `ReadonlyMap<EtfManager, EtfComponentAdapter>` enables clean extension for new fund managers
  2. `abortablePromise` helper is essential for clean abort during long-running async operations
  3. Chunked processing with inter-chunk delays prevents rate limiting from fund manager websites
  4. Fixture-based adapter testing (XLS/HTML files) provides reliable, deterministic test coverage

- **Next Actions**:
  1. Phase 2: Component change tracking / delta detection between snapshots
  2. Phase 2: UI tabs for ETF component display on product detail page (future PRD)
  3. Phase 2: Weight trend analysis and cross-ETF overlap analysis
  4. Samsung Fund/KODEX adapter (deferred — requires additional URL scheme reverse-engineering)
