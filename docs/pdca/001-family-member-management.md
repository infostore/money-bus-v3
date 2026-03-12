---
type: pdca-plan
plan-name: Family Member Management
related-prd: PRD-FEAT-001
phase: check
status: in-progress
created: 2026-03-12
updated: 2026-03-12
tags: [pdca, family, member, settings, crud]
---

# PDCA Plan: Family Member Management

## Plan

- **Goal**: Implement full CRUD for family members — DB schema through Settings UI — as the first domain entity in money-bus-v3.

- **Scope**:
  - Wave 1: Shared types + Drizzle schema + migration
  - Wave 2: FamilyMemberRepository (TDD: RED → GREEN)
  - Wave 3: Hono routes with Zod validation (TDD: RED → GREEN)
  - Wave 4: Client API module + useFamilyMembers hook (TDD: RED → GREEN)
  - Wave 5: FamilyMemberView + sub-components + Settings integration

- **Success Metrics**:
  - [x] Family member CRUD works end-to-end (API → DB → UI)
  - [x] PUT updates only provided fields; `updated_at` is explicitly set on every update
  - [x] POST validates name uniqueness (409 on duplicate)
  - [x] PUT validates name uniqueness against other members (409 on duplicate); same-name self-update does NOT return 409
  - [x] POST returns 400 for invalid input (Zod validation)
  - [x] DELETE returns 404 for non-existent ID
  - [x] GET returns empty array when no members exist
  - [x] Tests achieve 80%+ coverage for new code (repo: 100%, routes: 94.59%)
  - [x] Settings UI shows family member management with create/edit modal
  - [x] Delete confirmation modal appears before deletion
  - [x] UI displays empty state, loading spinner, and error feedback

## Do

- **Tasks**:
  - [x] Wave 1-A: Add `FamilyMember`, `CreateFamilyMemberPayload`, `UpdateFamilyMemberPayload` to `src/shared/types.ts`
  - [x] Wave 1-B: Add `familyMembers` table to `src/server/database/schema.ts` (Drizzle pgTable)
  - [x] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`)
  - [x] Wave 2-A: Write `FamilyMemberRepository` unit tests (RED) — findAll, findById, create, update, delete, uniqueness
  - [x] Wave 2-B: Implement `FamilyMemberRepository` in `src/server/database/family-member-repository.ts` (GREEN + REFACTOR)
  - [x] Wave 3-A: Write Hono route integration tests (RED) — all 4 endpoints, 400/404/409 branches
  - [x] Wave 3-B: Implement `createFamilyMemberRoutes` in `src/server/routes/family-members.ts` with Zod validation and pg error 23505 handling (GREEN + REFACTOR)
  - [x] Wave 3-C: Register `/api/family-members` route in `src/server/index.ts`
  - [x] Wave 4-B: Add `familyMembersApi` to `src/client/src/lib/api.ts` and `useFamilyMembers` hook to `src/client/src/features/settings/use-family-members.ts`
  - [x] Wave 5-A: Implement `FamilyMemberTable`, `FamilyMemberFormModal`, `FamilyMemberDeleteModal` sub-components under `src/client/src/features/settings/components/`
  - [x] Wave 5-B: Implement `FamilyMemberView` and integrate into `SettingsView`

- **Progress Log**:
  - 2026-03-12: PDCA plan created
  - 2026-03-12: Phase transition plan → do. Implementation begins.
  - 2026-03-12: Waves 1-3 complete. 25 backend tests passing. Types clean.
  - 2026-03-12: Waves 4-5 complete. Client API, hook, and UI components implemented.
  - 2026-03-12: Phase transition do → check. 39 tests passing. Coverage: repo 100%, routes 94.59%.

## Check

- **Results**:
  - 39 tests passing (19 repo + 17 route + 3 logger)
  - Coverage for new code: family-member-repository.ts 100%, family-members.ts (routes) 94.59%
  - Overall coverage 74.94% (dragged down by pre-existing untested files: shutdown.ts, setup.ts, items.ts)
  - TypeScript: `npx tsc --noEmit` — no errors
  - All PRD acceptance criteria met

- **Evidence**:
  - `npx vitest run --coverage` — 39/39 passed
  - `npx tsc --noEmit` — clean

## Act

- **Learnings**:
  1. [To be filled after Check phase]

- **Next Actions**:
  1. [To be filled after Check phase]
