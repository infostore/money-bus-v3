---
type: pdca-plan
plan-name: Family Member Management
related-prd: PRD-FEAT-001
phase: plan
status: not-started
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
  - [ ] Family member CRUD works end-to-end (API → DB → UI)
  - [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
  - [ ] POST validates name uniqueness (409 on duplicate)
  - [ ] PUT validates name uniqueness against other members (409 on duplicate); same-name self-update does NOT return 409
  - [ ] POST returns 400 for invalid input (Zod validation)
  - [ ] DELETE returns 404 for non-existent ID
  - [ ] GET returns empty array when no members exist
  - [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
  - [ ] Settings UI shows family member management with create/edit modal
  - [ ] Delete confirmation modal appears before deletion
  - [ ] UI displays empty state, loading spinner, and error feedback

## Do

- **Tasks**:
  - [ ] Wave 1-A: Add `FamilyMember`, `CreateFamilyMemberPayload`, `UpdateFamilyMemberPayload` to `src/shared/types.ts`
  - [ ] Wave 1-B: Add `familyMembers` table to `src/server/database/schema.ts` (Drizzle pgTable)
  - [ ] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`)
  - [ ] Wave 2-A: Write `FamilyMemberRepository` unit tests (RED) — findAll, findById, create, update, delete, uniqueness
  - [ ] Wave 2-B: Implement `FamilyMemberRepository` in `src/server/database/family-member-repository.ts` (GREEN + REFACTOR)
  - [ ] Wave 3-A: Write Hono route integration tests (RED) — all 4 endpoints, 400/404/409 branches
  - [ ] Wave 3-B: Implement `createFamilyMemberRoutes` in `src/server/routes/family-members.ts` with Zod validation and pg error 23505 handling (GREEN + REFACTOR)
  - [ ] Wave 3-C: Register `/api/family-members` route in `src/server/index.ts`
  - [ ] Wave 4-A: Write `useFamilyMembers` hook tests (RED)
  - [ ] Wave 4-B: Add `familyMembersApi` to `src/client/src/lib/api/` and `useFamilyMembers` hook to `src/client/src/features/settings/use-family-members.ts` (GREEN + REFACTOR)
  - [ ] Wave 5-A: Implement `FamilyMemberTable`, `FamilyMemberFormModal`, `FamilyMemberDeleteModal` sub-components under `src/client/src/features/settings/components/`
  - [ ] Wave 5-B: Implement `FamilyMemberView` and integrate into `SettingsView`
  - [ ] Wave 5-C: Verify empty state, loading spinner, and error alert render correctly in all three UI states

- **Progress Log**:
  - 2026-03-12: PDCA plan created

## Check

- **Results**:
  - [To be filled after Do phase]

- **Evidence**:
  - [Test coverage report, manual smoke test screenshots]

## Act

- **Learnings**:
  1. [To be filled after Check phase]

- **Next Actions**:
  1. [To be filled after Check phase]
