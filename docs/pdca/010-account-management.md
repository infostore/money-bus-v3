---
type: pdca-plan
plan-name: Account Management (계좌 관리)
related-prd: PRD-FEAT-010
phase: plan
status: not-started
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, account, crud, master-data]
---

# PDCA Plan: Account Management (계좌 관리)

## Plan

- **Goal**: 계좌 마스터 데이터 CRUD 기능 구현 — DB 스키마, API, 프론트엔드 UI 포함. FK JOIN을 통한 상세 정보 표시 및 소유자별 필터 지원.

- **Scope**:
  - Wave 1: Drizzle schema (accounts table with FKs) + migration + shared types
  - Wave 2: AccountRepository (JOIN queries) + repository tests
  - Wave 3: Hono REST API routes + Zod validation + route tests
  - Wave 4: Client API methods + useAccounts hook + hook tests
  - Wave 5a: AccountView + AccountTable + owner filter + account number masking
  - Wave 5b: AccountFormModal (FK select dropdowns) + AccountDeleteModal + route wiring

- **Success Metrics**:
  - [ ] Account CRUD works end-to-end (API → DB → UI)
  - [ ] GET /api/accounts returns joined details sorted by account_name ASC
  - [ ] POST validates FK references and account_name uniqueness
  - [ ] PUT partial update with explicit updated_at
  - [ ] DELETE with 404 for non-existent ID
  - [ ] FK onDelete: 'restrict' prevents deleting referenced master data
  - [ ] Owner filter works (client-side useMemo)
  - [ ] Account number masked in table view
  - [ ] Tests achieve 80%+ coverage
  - [ ] Select dropdowns populated from existing hooks

## Do

- **Tasks**:
  - [ ] Wave 1: Schema + types
    - [ ] Add `accounts` table to schema.ts with FK references
    - [ ] Generate Drizzle migration
    - [ ] Add Account, AccountWithDetails, CreateAccountPayload, UpdateAccountPayload to shared types
  - [ ] Wave 2: Repository
    - [ ] Write repository tests (RED)
    - [ ] Implement AccountRepository with JOIN queries (GREEN)
    - [ ] Refactor
  - [ ] Wave 3: API routes
    - [ ] Write route tests (RED)
    - [ ] Implement Hono routes with Zod validation (GREEN)
    - [ ] Handle 23505 (unique) and 23503 (FK) errors
  - [ ] Wave 4: Client hook
    - [ ] Add api.accounts methods to client API
    - [ ] Implement useAccounts hook with TanStack Query
  - [ ] Wave 5: UI
    - [ ] AccountView with owner filter
    - [ ] AccountTable with masked account numbers
    - [ ] AccountFormModal with FK select dropdowns
    - [ ] AccountDeleteModal
    - [ ] Wire route (replace ComingSoon)

- **Progress Log**:
  - 2026-03-13: PDCA plan created

## Check

- **Results**:
  - [Pending implementation]

- **Evidence**:
  - [Pending verification]

## Act

- **Learnings**:
  1. [Pending completion]

- **Next Actions**:
  1. [Pending completion]
