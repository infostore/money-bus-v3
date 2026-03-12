---
type: pdca-plan
plan-name: Institution Management
related-prd: PRD-FEAT-002
phase: plan
status: not-started
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
  - [ ] Institution CRUD works end-to-end (API → DB → UI)
  - [ ] Default 25 institutions seeded on first launch (single transaction, no partial seed on failure)
  - [ ] GET /api/institutions returns sorted list by name
  - [ ] GET /api/institutions?category=증권 filters correctly
  - [ ] POST validates name uniqueness (409 on duplicate)
  - [ ] PUT validates name uniqueness against other institutions (409 on duplicate)
  - [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
  - [ ] POST returns 400 for invalid input (Zod validation)
  - [ ] DELETE returns 404 for non-existent ID
  - [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
  - [ ] Settings UI shows institution management with create/edit modal
  - [ ] Category filter works correctly (전체/증권/은행/운용사)
  - [ ] Delete confirmation modal appears before deletion
  - [ ] UI displays empty state, loading spinner, and error feedback

## Do

- **Tasks**:
  - [ ] Wave 1-A: Add `Institution`, `CreateInstitutionPayload`, `UpdateInstitutionPayload` to `src/shared/types.ts`
  - [ ] Wave 1-B: Add `institutions` table to `src/server/database/schema.ts` (Drizzle pgTable with serial PK, name unique, category text, timestamps)
  - [ ] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`)
  - [ ] Wave 2-A: Write `InstitutionRepository` unit tests (RED) — findAll, findAll with category filter, findById, create, update, delete, count, seed, uniqueness constraints
  - [ ] Wave 2-B: Implement `InstitutionRepository` in `src/server/database/institution-repository.ts` (GREEN + REFACTOR) including `seed()` with 25 default institutions in a single transaction
  - [ ] Wave 2-C: Wire seed call in `src/server/index.ts` after `runMigrations()` — call `repo.seed()` only when `count() === 0`
  - [ ] Wave 3-A: Write Hono route integration tests (RED) — GET (list + category filter), POST (201/400/409), PUT (200/400/404/409/empty-body), DELETE (200/404), pg error 23505 → 409
  - [ ] Wave 3-B: Implement `createInstitutionRoutes` in `src/server/routes/institutions.ts` with Zod validation, pg unique violation (23505) → 409 handling (GREEN + REFACTOR)
  - [ ] Wave 3-C: Register `/api/institutions` route in `src/server/index.ts`
  - [ ] Wave 4-A: Add `institutionsApi` to `src/client/src/lib/api.ts` (list, create, update, delete)
  - [ ] Wave 4-B: Implement `useInstitutions` hook in `src/client/src/features/settings/use-institutions.ts` using TanStack Query (`invalidateQueries` on mutation success)
  - [ ] Wave 5a-A: Implement `InstitutionTable` component in `src/client/src/features/settings/components/InstitutionTable.tsx` (name + category columns, edit/delete action buttons)
  - [ ] Wave 5a-B: Implement `InstitutionView` skeleton in `src/client/src/features/settings/InstitutionView.tsx` with category filter tabs (전체/증권/은행/운용사), empty state, loading spinner, error alert
  - [ ] Wave 5b-A: Implement `InstitutionFormModal` in `src/client/src/features/settings/components/InstitutionFormModal.tsx` (create/edit dual mode via optional `institution?` prop, inline error feedback on 400/409, loading spinner on submit, disabled double-submit)
  - [ ] Wave 5b-B: Implement `InstitutionDeleteModal` in `src/client/src/features/settings/components/InstitutionDeleteModal.tsx` (confirmation modal: title "금융기관 삭제", body "'${name}'을(를) 삭제하시겠습니까?")
  - [ ] Wave 5b-C: Integrate `InstitutionView` into `SettingsView` as a new section

- **Progress Log**:
  - 2026-03-12: PDCA plan created

## Check

- **Results**:
  - [TBD after implementation]

- **Evidence**:
  - [TBD after implementation]

## Act

- **Learnings**:
  - [TBD after implementation]

- **Next Actions**:
  - [TBD after implementation]
