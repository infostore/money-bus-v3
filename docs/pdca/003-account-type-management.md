---
type: pdca-plan
plan-name: Account Type Management
related-prd: PRD-FEAT-003
phase: act
status: completed
created: 2026-03-12
updated: 2026-03-12
tags: [pdca, account-type, settings, crud, master-data]
---

# PDCA Plan: Account Type Management

## Plan

- **Goal**: Implement full CRUD for account types — Drizzle schema through Settings UI — including 13 Korean account type seed data, tax treatment filtering, and Zod-validated API endpoints.

- **Scope**:
  - Wave 1: Shared types + Drizzle schema + migration
  - Wave 2: AccountTypeRepository (TDD: RED → GREEN) + seed logic
  - Wave 3: Hono routes with Zod validation (TDD: RED → GREEN)
  - Wave 4: Client API module + useAccountTypes hook
  - Wave 5a: AccountTypeView skeleton + AccountTypeTable + tax treatment filter
  - Wave 5b: AccountTypeFormModal + AccountTypeDeleteModal + Settings integration

- **Success Metrics**:
  - [ ] Account type CRUD works end-to-end (API → DB → UI)
  - [ ] Default 13 account types seeded on first launch (single transaction, no partial seed on failure)
  - [ ] GET /api/account-types returns sorted list by name
  - [ ] Tax treatment filter works client-side via useMemo (no server-side filtering)
  - [ ] POST validates name uniqueness (409 on duplicate)
  - [ ] PUT validates name uniqueness against other account types (409 on duplicate)
  - [ ] PUT with same name (no change) does not return 409
  - [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
  - [ ] POST returns 400 for invalid input (Zod validation)
  - [ ] PUT returns 400 for empty body `{}`
  - [ ] DELETE returns 404 for non-existent ID
  - [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
  - [ ] Settings UI shows account type management with create/edit modal
  - [ ] Tax treatment filter works correctly (전체/세금우대/일반/연금)
  - [ ] Delete confirmation modal appears before deletion
  - [ ] UI displays empty state, loading spinner, and error feedback

## Do

- **Tasks**:
  - [ ] Wave 1-A: Add `AccountType`, `CreateAccountTypePayload`, `UpdateAccountTypePayload` to `src/shared/types.ts`
  - [ ] Wave 1-B: Add `accountTypes` table to `src/server/database/schema.ts` (Drizzle pgTable with serial PK, name unique, tax_treatment text default '일반', timestamps)
  - [ ] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`)
  - [ ] Wave 2-A: Write `AccountTypeRepository` unit tests (RED) — findAll, findById, create, update, delete, count, seed, uniqueness constraints
  - [ ] Wave 2-B: Implement `AccountTypeRepository` in `src/server/database/account-type-repository.ts` (GREEN + REFACTOR) including `seed()` with 13 default account types in a single transaction
  - [ ] Wave 2-C: Wire seed call in `src/server/index.ts` after `runMigrations()` — call `accountTypeRepo.seed()` only when `count() === 0`
  - [ ] Wave 3-A: Write Hono route integration tests (RED) — GET (list), POST (201/400/409), PUT (200/400/404/409/empty-body/same-name-no-409), DELETE (200/404), pg error 23505 → 409
  - [ ] Wave 3-B: Implement `createAccountTypeRoutes` in `src/server/routes/account-types.ts` with Zod validation, pg unique violation (23505) → 409 handling (GREEN + REFACTOR)
  - [ ] Wave 3-C: Register `/api/account-types` route in `src/server/index.ts`
  - [ ] Wave 4-A: Add `accountTypesApi` to `src/client/src/lib/api.ts` (list, create, update, delete)
  - [ ] Wave 4-B: Implement `useAccountTypes` hook in `src/client/src/features/settings/use-account-types.ts` using TanStack Query (`invalidateQueries` on mutation success)
  - [ ] Wave 5a-A: Implement `AccountTypeTable` component in `src/client/src/features/settings/components/AccountTypeTable.tsx` (name + tax_treatment columns, edit/delete action buttons)
  - [ ] Wave 5a-B: Implement `AccountTypeView` skeleton in `src/client/src/features/settings/AccountTypeView.tsx` with tax treatment filter tabs (전체/세금우대/일반/연금), empty state, loading spinner, error alert
  - [ ] Wave 5b-A: Implement `AccountTypeFormModal` in `src/client/src/features/settings/components/AccountTypeFormModal.tsx` (create/edit dual mode via optional `accountType?` prop, inline error feedback on 400/409, loading spinner on submit, disabled double-submit)
  - [ ] Wave 5b-B: Implement `AccountTypeDeleteModal` in `src/client/src/features/settings/components/AccountTypeDeleteModal.tsx` (confirmation modal: title "계좌유형 삭제", body "'{name}'을(를) 삭제하시겠습니까?")
  - [ ] Wave 5b-C: Add `/account-types` route to `routes/settings.ts` and nav item (label: '계좌유형', icon: Landmark) to `navigation.ts`
  - [ ] Wave 5b-D: Integrate `AccountTypeView` into `SettingsView` as a new section

- **Progress Log**:
  - 2026-03-12: PDCA plan created
  - 2026-03-12: Phase transition plan → do. Implementation started.
  - 2026-03-12: All waves completed. 101 tests passing, coverage > 80%. Phase transition do → check.
  - 2026-03-12: Review fixes applied. Phase transition check → act. Status: completed.

## Check

- **Results**:
  - All 16 tasks completed across 5 waves
  - 101 tests passing (37 new: 17 repository + 20 route tests)
  - Coverage: 83.63% statements, 81.77% branches, 91.37% functions, 83.63% lines (all > 80%)
  - TypeScript: zero type errors (`npx tsc --noEmit` clean)
  - Code review: 0 CRITICAL, 3 HIGH (all fixed — Korean error messages)
  - Security review: passed
  - 13 default account types seeded in single transaction

- **Evidence**:
  - `npx vitest run --coverage`: 101/101 tests pass, all coverage metrics > 80%
  - `npx tsc --noEmit`: clean
  - Code review: English error strings fixed to Korean in account-types.ts
  - Files created: 10 new, 5 modified

## Act

- **Learnings**:
  - PRD-FEAT-002 patterns (Institution Management) transferred cleanly — same repository, route, hook, and UI patterns
  - Client-side filtering via useMemo is simpler than server-side query param filtering for small datasets
  - English error messages from institution routes were carried forward; caught in code review — always check Korean UI convention
  - Subagent-driven TDD (3 parallel agents for waves 2/3/4-5) was efficient for this CRUD pattern

- **Next Actions**:
  - Merge to main via PR
  - Future: link account_types to accounts table via FK (deferred to accounts PRD)
