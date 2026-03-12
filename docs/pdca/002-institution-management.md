---
type: pdca-plan
plan-name: Institution Management
related-prd: PRD-FEAT-002
phase: act
status: completed
created: 2026-03-12
updated: 2026-03-12
tags: [pdca, institution, settings, crud, master-data]
---

# PDCA Plan: Institution Management

## Plan

- **Goal**: Implement full CRUD for financial institutions — Drizzle schema through Settings UI — including 25 Korean institution seed data, category filtering, and Zod-validated API endpoints.

- **Scope**:
  - Wave 1: Shared types + Drizzle schema + migration
  - Wave 2: InstitutionRepository (TDD: RED → GREEN) + seed logic
  - Wave 3: Hono routes with Zod validation (TDD: RED → GREEN)
  - Wave 4: Client API module + useInstitutions hook
  - Wave 5a: InstitutionView skeleton + InstitutionTable + category filter
  - Wave 5b: InstitutionFormModal + InstitutionDeleteModal + Settings integration

- **Success Metrics**:
  - [x] Institution CRUD works end-to-end (API → DB → UI)
  - [x] Default 25 institutions seeded on first launch (single transaction, no partial seed on failure)
  - [x] GET /api/institutions returns sorted list by name
  - [x] GET /api/institutions?category=증권 filters correctly
  - [x] POST validates name uniqueness (409 on duplicate)
  - [x] PUT validates name uniqueness against other institutions (409 on duplicate)
  - [x] PUT updates only provided fields; `updated_at` is explicitly set on every update
  - [x] POST returns 400 for invalid input (Zod validation)
  - [x] DELETE returns 404 for non-existent ID
  - [x] Tests achieve 80%+ coverage (statements, branches, functions, lines)
  - [x] Settings UI shows institution management with create/edit modal
  - [x] Category filter works correctly (전체/증권/은행/운용사)
  - [x] Delete confirmation modal appears before deletion
  - [x] UI displays empty state, loading spinner, and error feedback

## Do

- **Tasks**:
  - [x] Wave 1-A: Add `Institution`, `CreateInstitutionPayload`, `UpdateInstitutionPayload` to `src/shared/types.ts`
  - [x] Wave 1-B: Add `institutions` table to `src/server/database/schema.ts` (Drizzle pgTable with serial PK, name unique, category text, timestamps)
  - [x] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`)
  - [x] Wave 2-A: Write `InstitutionRepository` unit tests (RED) — findAll, findAll with category filter, findById, create, update, delete, count, seed, uniqueness constraints
  - [x] Wave 2-B: Implement `InstitutionRepository` in `src/server/database/institution-repository.ts` (GREEN + REFACTOR) including `seed()` with 25 default institutions in a single transaction
  - [x] Wave 2-C: Wire seed call in `src/server/index.ts` after `runMigrations()` — call `repo.seed()` only when `count() === 0`
  - [x] Wave 3-A: Write Hono route integration tests (RED) — GET (list + category filter), POST (201/400/409), PUT (200/400/404/409/empty-body), DELETE (200/404), pg error 23505 → 409
  - [x] Wave 3-B: Implement `createInstitutionRoutes` in `src/server/routes/institutions.ts` with Zod validation, pg unique violation (23505) → 409 handling (GREEN + REFACTOR)
  - [x] Wave 3-C: Register `/api/institutions` route in `src/server/index.ts`
  - [x] Wave 4-A: Add `institutionsApi` to `src/client/src/lib/api.ts` (list, create, update, delete)
  - [x] Wave 4-B: Implement `useInstitutions` hook in `src/client/src/features/settings/use-institutions.ts` using TanStack Query (`invalidateQueries` on mutation success)
  - [x] Wave 5a-A: Implement `InstitutionTable` component in `src/client/src/features/settings/components/InstitutionTable.tsx` (name + category columns, edit/delete action buttons)
  - [x] Wave 5a-B: Implement `InstitutionView` skeleton in `src/client/src/features/settings/InstitutionView.tsx` with category filter tabs (전체/증권/은행/운용사), empty state, loading spinner, error alert
  - [x] Wave 5b-A: Implement `InstitutionFormModal` in `src/client/src/features/settings/components/InstitutionFormModal.tsx` (create/edit dual mode via optional `institution?` prop, inline error feedback on 400/409, loading spinner on submit, disabled double-submit)
  - [x] Wave 5b-B: Implement `InstitutionDeleteModal` in `src/client/src/features/settings/components/InstitutionDeleteModal.tsx` (confirmation modal: title "금융기관 삭제", body "'${name}'을(를) 삭제하시겠습니까?")
  - [x] Wave 5b-C: Integrate `InstitutionView` into `SettingsView` as a new section

- **Progress Log**:
  - 2026-03-12: PDCA plan created
  - 2026-03-12: Phase transition plan → do. Implementation begins.
  - 2026-03-12: Waves 1-5 complete. 64 total tests passing (24 institution + 18 family + 19 repo + 3 logger).
  - 2026-03-12: Phase transition do → check. Coverage: statements 80.31%, branches 81.94%, functions 88.63%, lines 80.31%.

## Check

- **Results**:
  - 64 tests passing (24 institution routes + seed, 18 family member, 19 repo, 3 logger)
  - Coverage for new code: institution-repository.ts 94.54%, institutions.ts (routes) 88.3%
  - Overall coverage: 80.31% statements, 81.94% branches, 88.63% functions, 80.31% lines
  - TypeScript: `npx tsc --noEmit` — no errors
  - All PRD acceptance criteria met

- **Evidence**:
  - `npx vitest run --coverage` — 64/64 passed, all metrics >= 80%
  - `npx tsc --noEmit` — clean
  - Code review: CRITICAL=0, HIGH=2 (fixed), MEDIUM=4 (deferred)

- **Progress Log** (continued):
  - 2026-03-12: Code review completed. 0 CRITICAL, 2 HIGH issues identified and fixed.
  - 2026-03-12: Phase transition check → act. Status: completed.

## Act

- **Learnings**:
  1. Zod v4 default messages are English — always supply Korean `.message()` overrides for user-facing validation
  2. Seed methods should use batch insert + `onConflictDoNothing()` for idempotency and race condition safety
  3. The `strict()` schema modifier rejects unknown fields at Zod level, reducing the need for manual field checking
  4. Category filtering can be done client-side with `useMemo` when the full dataset is small (25 records)

- **Next Actions**:
  1. Feature complete. No follow-up actions required.
