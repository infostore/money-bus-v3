---
type: prd
prd-id: PRD-FEAT-010
prd-type: feature
title: Account Management (계좌 관리)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, account, settings, crud, master-data]
---

# Feature: Account Management (계좌 관리)

## 1. Overview

자산을 기록할 때 계좌 정보를 자유 텍스트로 입력하면 "삼성증권 ISA"/"삼성 ISA계좌"/"삼성증권(ISA)" 등 표기 불일치 문제가 발생하며, 같은 계좌를 여러 보유종목에서 참조할 때 데이터 일관성이 무너진다. 계좌 마스터 테이블을 별도로 관리하여 금융기관·계좌유형·소유자를 표준화하고, 향후 보유종목 폼에서 계좌를 드롭다운으로 선택할 수 있는 기반을 마련한다.

계좌 관리 기능은 사용자가 보유한 금융 계좌를 등록·수정·삭제할 수 있는 설정 화면을 제공한다. 각 계좌는 계좌명(account_name), 계좌번호(account_number, 선택), 소유자(family_member_id FK), 금융기관(institution_id FK), 계좌유형(account_type_id FK) 필드를 가지며, 소유자별 필터를 지원한다.

v1에서 검증된 계좌 관리 기능을 v3 스택(PostgreSQL + Drizzle ORM)으로 마이그레이션한다. PRD-FEAT-001~004와 동일한 Settings CRUD 패턴을 따르며, FK 조인을 통한 상세 정보 표시를 포함한다.

**Core Value:**
- 계좌 정보를 한 곳에서 관리하여 표기 불일치 해소
- 가족구성원·금융기관·계좌유형 FK 연결로 데이터 정합성 보장
- 향후 보유종목(holdings)에서 계좌를 참조하는 기반 마련
- 소유자별 필터로 가족 구성원별 계좌 현황 파악

---

## 2. User Stories

- As a user, I want to view all registered accounts so I can see which accounts are available for holdings entry.
- As a user, I want to add a new account (e.g., a brokerage account I recently opened) so it appears in my account list.
- As a user, I want to update an account's name, institution, or type to correct mistakes or reflect changes.
- As a user, I want to delete an account I no longer use so the list stays clean.
- As a user, I want to filter accounts by family member so I can quickly see a specific person's accounts.
- As a user, I want to see the institution name, account type, and owner name in the list without navigating to each record.

---

## 3. Scope

### In Scope
- PostgreSQL `accounts` table (Drizzle schema + migration)
- FK references: `family_members.id`, `institutions.id`, `account_types.id`
- `AccountRepository` (Drizzle ORM) with joined query for details
- Hono REST API routes (GET/POST/PUT/DELETE `/api/accounts`)
- Shared TypeScript types (`Account`, `AccountWithDetails`, `CreateAccountPayload`, `UpdateAccountPayload`)
- `useAccounts` custom hook (client)
- `AccountView` component under Settings view
- Owner (family member) filter, client-side via `useMemo`
- Delete confirmation via existing Modal component
- Input validation via Zod
- `account_number` field (nullable, optional) — masked display in UI

### Out of Scope
- 계좌와 보유종목(holding) 간 FK 연결 (보유종목 PRD에서 처리)
- 계좌 잔고 조회 및 자동 동기화
- 계좌 정렬 순서 커스터마이징
- 외부 금융기관 API 연동 (계좌 자동 등록)
- 계좌별 거래 내역 관리

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View account list | Given accounts in DB, when user calls GET /api/accounts, then all accounts are returned with joined details (family member name, institution name, account type name) sorted by account_name ASC. UI shows table with account_name, account_number (masked), owner, institution, account_type columns. Empty state shown when no accounts exist. Loading spinner shown during fetch. |
| 2 | Add account | Given user enters account_name and selects family_member, institution, account_type, when they POST /api/accounts, then a new row is created (201). Invalid input returns 400 with Zod validation error. Duplicate account_name returns 409 ('이미 등록된 계좌입니다.'). Invalid FK IDs return 400. Modal closes on success and list refreshes. On 400 or 409, modal remains open with inline error message. |
| 3 | Update account | Given an existing account, when user sends PUT /api/accounts/:id with partial fields, then only provided fields are updated. `updated_at` is explicitly set to current timestamp. Non-existent ID returns 404. Duplicate account_name (different id) returns 409. PUT with same name (no change) must not return 409. Empty body `{}` returns 400 ('At least one field must be provided'). On error, modal remains open and shows inline error. |
| 4 | Delete account | Given an existing account, when user clicks delete, a confirmation Modal appears ('계좌 삭제', '{account_name}을(를) 삭제하시겠습니까?', confirm/cancel). On confirm, DELETE /api/accounts/:id removes the row. Non-existent ID returns 404. On future 409 FK violation (holdings), display '이 계좌에 보유종목이 있어 삭제할 수 없습니다.' without closing the modal. |
| 5 | Owner filter | Given accounts with different owners, when user selects a family member filter, then only that member's accounts are displayed. All filtering is done client-side using `useMemo`. When user selects '전체', full list is shown. When filtered result is empty, display EmptyState with message '해당 구성원의 계좌가 없습니다.' |
| 6 | Account number masking | Given an account with account_number '123-456-789012', UI displays '123-***-***012' (middle portion masked). Full number shown only in edit modal. Accounts without account_number show '-' in the column. |

---

## 5. Technical Design

### Architecture
```
Client (React)                     Server (Hono)
─────────────────                  ──────────────────
SettingsView                       Hono Routes
  └─ AccountView                     └─ /api/accounts
       ├─ useFamilyMembers                └─ AccountRepository
       ├─ useInstitutions                       └─ Drizzle ORM → PostgreSQL
       ├─ useAccountTypes                            (JOIN family_members,
       └─ useAccounts                                 institutions, account_types)
```

### Database Schema (Drizzle)
```typescript
// src/server/database/schema.ts (addition)
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  accountName: text('account_name').notNull().unique(),
  accountNumber: text('account_number'),                              // nullable
  familyMemberId: integer('family_member_id').notNull()
    .references(() => familyMembers.id, { onDelete: 'restrict' }),
  institutionId: integer('institution_id').notNull()
    .references(() => institutions.id, { onDelete: 'restrict' }),
  accountTypeId: integer('account_type_id').notNull()
    .references(() => accountTypes.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: FK `onDelete: 'restrict'` prevents orphaned accounts — family member, institution, or account type cannot be deleted while referenced. `updatedAt` uses `defaultNow()` for INSERT only. The repository `update()` method MUST explicitly set `updatedAt: new Date()` on every update call.

### Shared TypeScript Types (src/shared/types.ts)

Field names use snake_case to match the API/DB wire format, consistent with existing types.

```typescript
// PRD-FEAT-010: Account Management
export interface Account {
  readonly id: number
  readonly account_name: string
  readonly account_number: string | null
  readonly family_member_id: number
  readonly institution_id: number
  readonly account_type_id: number
  readonly created_at: string
  readonly updated_at: string
}

export interface AccountWithDetails {
  readonly id: number
  readonly account_name: string
  readonly account_number: string | null
  readonly family_member_id: number
  readonly family_member_name: string
  readonly institution_id: number
  readonly institution_name: string
  readonly account_type_id: number
  readonly account_type_name: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateAccountPayload {
  readonly account_name: string
  readonly account_number?: string | null
  readonly family_member_id: number
  readonly institution_id: number
  readonly account_type_id: number
}

export interface UpdateAccountPayload {
  readonly account_name?: string
  readonly account_number?: string | null
  readonly family_member_id?: number
  readonly institution_id?: number
  readonly account_type_id?: number
}
```

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/accounts` | List all accounts with details | `ApiResponse<AccountWithDetails[]>` |
| POST | `/api/accounts` | Create new account | `ApiResponse<AccountWithDetails>` (201) or 400/409 |
| PUT | `/api/accounts/:id` | Update account (partial) | `ApiResponse<AccountWithDetails>` or 400/404/409 |
| DELETE | `/api/accounts/:id` | Delete account | `ApiResponse<null>` (200) or 404 |

Note on PUT semantics: Uses PUT path with partial-update (PATCH) semantics by design, consistent with PRD-FEAT-001~004.

Note on uniqueness error handling: Route handlers MUST catch PostgreSQL unique violation error code `23505` → 409 ('이미 등록된 계좌입니다.'). Route handlers MUST catch FK violation error code `23503` on INSERT/UPDATE → 400 ('유효하지 않은 구성원/금융기관/계좌유형입니다.'), on DELETE (future holdings) → 409 ('이 계좌에 보유종목이 있어 삭제할 수 없습니다.').

Note on repository contract: If `repo.update()` returns `undefined`, respond 404. If `repo.delete()` returns `false`, respond 404.

### Repository (src/server/database/account-repository.ts)
```typescript
export class AccountRepository {
  constructor(private readonly db: Database) {}
  findAll(): Promise<readonly AccountWithDetails[]>       // JOIN family_members, institutions, account_types
  findById(id: number): Promise<AccountWithDetails | undefined>
  create(input: CreateAccountPayload): Promise<AccountWithDetails>
  update(id: number, input: UpdateAccountPayload): Promise<AccountWithDetails | undefined>
  delete(id: number): Promise<boolean>
  count(): Promise<number>
}
```

Note: `findAll()` and `findById()` return `AccountWithDetails` via JOIN query. `create()` and `update()` insert/update then re-fetch with JOIN to return details.

### Input Validation (Zod)
```typescript
const createAccountSchema = z.object({
  account_name: z.string().trim().min(1).max(100),
  account_number: z.string().trim().max(30).nullable().optional(),
  family_member_id: z.number().int().positive(),
  institution_id: z.number().int().positive(),
  account_type_id: z.number().int().positive(),
})

const updateAccountSchema = z.object({
  account_name: z.string().trim().min(1).max(100).optional(),
  account_number: z.string().trim().max(30).nullable().optional(),
  family_member_id: z.number().int().positive().optional(),
  institution_id: z.number().int().positive().optional(),
  account_type_id: z.number().int().positive().optional(),
}).strict().refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: 'At least one field must be provided' },
)
```

### Frontend Components
- `features/settings/AccountView.tsx` — 계좌 관리 페이지 (테이블 + 소유자 필터 + 모달 연결)
- `features/settings/components/AccountTable.tsx` — 계좌 목록 테이블 (account_name, account_number (masked), family_member_name, institution_name, account_type_name 컬럼)
- `features/settings/components/AccountFormModal.tsx` — 생성/수정 폼 모달. Optional `account?: AccountWithDetails` prop으로 create/edit 구분. Fields: account_name → account_number → family_member (select) → institution (select) → account_type (select), CTA: '저장'
- `features/settings/components/AccountDeleteModal.tsx` — 삭제 확인 모달
- `features/settings/use-accounts.ts` — API wrapping hook (colocated in feature)
- Route: `/accounts` (already registered in `routes/assets.ts`, currently `ComingSoon`)
- Navigation: 계좌 (Accounts) already in sidebar under '자산 관리' group
- States: empty (EmptyState), loading (Spinner), error (Alert), success (account list table)
- Delete confirmation: existing Modal component with title '계좌 삭제', body '{account_name}을(를) 삭제하시겠습니까?'
- Data refresh: On successful POST/PUT/DELETE, `useAccounts` calls `queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })`
- Modal error feedback: On 400 or 409, modal remains open with inline error message. '저장' button shows loading spinner during submission
- Select dropdowns: family_member, institution, account_type selects are populated from their respective hooks (`useFamilyMembers`, `useInstitutions`, `useAccountTypes`)

### Account Number Masking (Client-side utility)
```typescript
function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 6) return accountNumber
  const start = accountNumber.slice(0, 3)
  const end = accountNumber.slice(-3)
  const middle = accountNumber.slice(3, -3).replace(/[0-9]/g, '*')
  return `${start}${middle}${end}`
}
```

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (`accounts` table with FKs) + migration + shared types (`Account`, `AccountWithDetails`, `CreateAccountPayload`, `UpdateAccountPayload`) | Low |
| 2 | Repository tests (RED) + `AccountRepository` implementation (GREEN) with JOIN queries | Medium |
| 3 | API route tests (RED) + Hono routes with Zod validation (GREEN) — GET/POST/PUT/DELETE, FK validation, 409 on unique violation | Medium |
| 4 | Client: `api.accounts` methods + `useAccounts` hook + hook tests | Low |
| 5a | Client: `AccountView` skeleton + `AccountTable` + owner filter (client-side useMemo) + account number masking | Medium |
| 5b | Client: `AccountFormModal` (with FK select dropdowns) + `AccountDeleteModal` + route wiring (replace ComingSoon) | Medium |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] Account CRUD works end-to-end (API → DB → UI)
- [ ] GET /api/accounts returns list with joined details (member name, institution name, type name), sorted by account_name ASC
- [ ] POST validates all FK references exist (400 on invalid FK)
- [ ] POST validates account_name uniqueness (409 on duplicate, '이미 등록된 계좌입니다.')
- [ ] PUT validates account_name uniqueness against other accounts (409 on duplicate)
- [ ] PUT with same name (no change) does not return 409
- [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
- [ ] POST returns 400 for invalid input (Zod validation)
- [ ] PUT returns 400 for empty body `{}`
- [ ] DELETE returns 404 for non-existent ID
- [ ] FK onDelete: 'restrict' prevents deleting referenced family members, institutions, account types
- [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
- [ ] Settings UI shows account management with create/edit modal
- [ ] Owner filter works correctly (전체 + each family member)
- [ ] Account number is masked in table, full in edit modal
- [ ] Delete confirmation modal appears before deletion
- [ ] UI displays empty state, loading spinner, and error feedback
- [ ] Select dropdowns for family member, institution, account type are populated correctly

---

## 8. Dependencies

- PRD-FEAT-001 (Family Member Management) — `family_members.id` FK, UI 패턴 참조
- PRD-FEAT-002 (Institution Management) — `institutions.id` FK, CRUD 패턴 참조
- PRD-FEAT-003 (Account Type Management) — `account_types.id` FK, 필터 패턴 참조
- PRD-FEAT-004 (Product Management) — CRUD 패턴 참조 (Zod, repository, route patterns)
- Reuses existing UI components: Modal, Input, Select, Button, Card, EmptyState, Spinner, Alert
- Reuses existing hooks: `useFamilyMembers`, `useInstitutions`, `useAccountTypes`
- Future dependency: 보유종목(holding) PRD — `accounts.id` FK will be referenced from holdings table

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Account name uniqueness conflict | Low | UNIQUE constraint on `accounts.account_name` + 409 response on POST and PUT |
| Invalid FK references on create/update | Medium | Zod validates positive integer; DB FK constraint catches invalid IDs; catch `23503` → 400 |
| FK restrict prevents master data deletion | Medium | UI should warn users; PRD-001/002/003 DELETE routes should catch `23503` → 409 with descriptive message |
| Future holdings FK delete constraint | Medium | Deferred to holdings PRD; catch pg error `23503` → 409 when implemented |
| Account number privacy | Low | Client-side masking in table view; full number only in edit modal |
| Cascading PRD updates to PRD-001/002/003 | Low | DELETE routes in existing features should add `23503` catch for FK restrict; can be done as chore |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for money-bus-v3, adapted from v1 account management for PostgreSQL + Drizzle ORM stack. Follows PRD-FEAT-004 patterns with FK JOIN queries. |
