---
type: prd
prd-id: PRD-FEAT-003
prd-type: feature
title: Account Type Management (계좌유형 관리)
status: approved
implementation-status: completed
created: 2026-03-12
updated: 2026-03-12
author: -
tags: [prd, account-type, settings, crud, master-data]
---

# Feature: Account Type Management (계좌유형 관리)

## 1. Overview

계좌유형(예: 개인종합자산관리계좌, 연금저축계좌, 일반위탁계좌) 마스터 데이터를 관리하는 설정 기능이다.

계좌를 생성할 때 유형을 자유 텍스트로 입력하면 "ISA"/"isa"/"아이에스에이" 등 표기 불일치 문제가 발생한다. 계좌유형 목록을 별도 테이블로 관리하여 일관성을 확보하고, 향후 계좌 폼에서 드롭다운 선택으로 전환할 수 있는 기반을 마련한다.

v1(PRD-FEAT-001)에서 검증된 계좌유형 관리 기능을 v3 스택(PostgreSQL + Drizzle ORM)으로 마이그레이션한다. PRD-FEAT-001(가족 구성원 관리), PRD-FEAT-002(금융기관 관리)와 동일한 CRUD 패턴을 따른다.

**Core Value:**
- 계좌유형 목록을 한 곳에서 관리
- 유형명 표기 일관성 확보
- 한국 주요 계좌유형 시드 데이터 제공 (세금우대/일반/연금 분류)
- 향후 계좌 폼에서 드롭다운 선택으로 전환 가능

---

## 2. User Stories

- As a user, I want to view a list of all registered account types so I can see which types are available for account creation.
- As a user, I want to add a new account type (e.g., a new tax-advantaged account type I discovered).
- As a user, I want to update an account type's name or tax treatment to fix mistakes.
- As a user, I want to delete an account type I no longer use.
- As a user, I want default Korean account types pre-loaded so I don't have to enter common types manually.

---

## 3. Scope

### In Scope
- PostgreSQL `account_types` table (Drizzle schema + migration)
- `AccountTypeRepository` (Drizzle ORM)
- Hono REST API routes (GET/POST/PUT/DELETE /api/account-types)
- Shared TypeScript types (`AccountType`, `CreateAccountTypePayload`, `UpdateAccountTypePayload`)
- Default seed data (Korean account types: 세금우대/일반/연금 categories)
- `useAccountTypes` custom hook (client)
- `AccountTypeView` component under Settings view
- Tax treatment filter (전체/세금우대/일반/연금)
- Delete confirmation via existing Modal component
- Input validation via Zod
- `short_code` 필드 (nullable, 선택 입력) — 단축코드 (예: ISA, IRP, DC)

### Out of Scope
- 계좌유형과 계좌 간 FK 연결 (계좌 PRD에서 처리)
- 계좌유형별 세부 세금 규정 저장
- 계좌유형 정렬 순서 커스터마이징

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View account type list | Given account types in DB, when user calls GET /api/account-types, then all types are returned sorted by name ASC. UI shows table with name, tax_treatment columns. Empty state shown when no types exist. Loading spinner shown during fetch. Optional `?tax_treatment=세금우대` query param filters by tax treatment. |
| 2 | Add account type | Given user enters name and tax treatment, when they POST /api/account-types, then a new row is created (201). Invalid input returns 400 with Zod validation error. Duplicate name returns 409. Modal closes on success and list refreshes. On 400 or 409 response, the modal remains open and displays an inline error message below the form (e.g., '이미 등록된 계좌유형입니다.'). |
| 3 | Update account type | Given an existing account type, when user sends PUT /api/account-types/:id with partial fields, then only provided fields are updated. `updated_at` is explicitly set to current timestamp. Non-existent ID returns 404. Duplicate name (different id) returns 409. A PUT with the same name as the current type (no name change) must not return 409. Empty body `{}` returns 400 ("At least one field must be provided"). On error, the modal remains open and shows an inline error message. |
| 4 | Delete account type | Given an existing account type, when user clicks delete, a confirmation Modal appears ("계좌유형 삭제", "'{name}'을(를) 삭제하시겠습니까?", confirm/cancel buttons). On confirm, DELETE /api/account-types/:id removes the row. Non-existent ID returns 404. On DELETE error, the confirmation modal closes and an `Alert` error message is displayed in the `AccountTypeView`. On future 409 FK violation, display '이 계좌유형은 사용 중인 계좌가 있어 삭제할 수 없습니다.' without closing the modal. |
| 5 | Default seed data | Given first launch, when account_types table is empty, then default Korean account types are seeded automatically. Seed runs at server startup in `src/server/index.ts`, after `runMigrations()`, before serving requests. If `count() === 0`, call `repo.seed()` within a single transaction. |
| 6 | Tax treatment filter | Given account types with mixed tax treatments, when user selects a filter, then only matching types are displayed. All filtering is done client-side using `useMemo`: `useAccountTypes` always fetches the full list (no query param), and the filter buttons filter the cached array in memory. When user selects '전체', the full list is shown. This matches the `InstitutionView` category filter pattern. |

---

## 5. Technical Design

### Architecture
```
Client (React)                     Server (Hono)
─────────────────                  ──────────────────
SettingsView                       Hono Routes
  └─ AccountTypeView                 └─ /api/account-types
       └─ useAccountTypes                 └─ AccountTypeRepository
                                               └─ Drizzle ORM → PostgreSQL
```

### Database Schema (Drizzle)
```typescript
// src/server/database/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const accountTypes = pgTable('account_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  taxTreatment: text('tax_treatment').notNull().default('일반'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: `updatedAt` uses `defaultNow()` for INSERT only. The repository `update()` method MUST explicitly set `updatedAt: new Date()` on every update call. Drizzle pg-core does not support `.$onUpdateFn()` — manual setting is required.

### Shared TypeScript Types (src/shared/types.ts)

Field names use snake_case to match the API/DB wire format, consistent with existing types.

```typescript
// PRD-FEAT-003: Account Type Management
export interface AccountType {
  readonly id: number
  readonly name: string
  readonly tax_treatment: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateAccountTypePayload {
  readonly name: string
  readonly tax_treatment?: string
}

export interface UpdateAccountTypePayload {
  readonly name?: string
  readonly tax_treatment?: string
}
```

### Tax Treatment Options

| Value | Label |
|-------|-------|
| 세금우대 | 세금우대 (Tax-Advantaged) |
| 일반 | 일반 (General) |
| 연금 | 연금 (Pension) |

### Default Seed Data (Korean Account Types)
```typescript
const DEFAULT_ACCOUNT_TYPES: readonly CreateAccountTypePayload[] = [
  // 세금우대 (Tax-Advantaged)
  { name: 'ISA (개인종합자산관리계좌)', tax_treatment: '세금우대' },
  { name: '비과세종합저축', tax_treatment: '세금우대' },
  { name: '청년도약계좌', tax_treatment: '세금우대' },
  { name: '청년희망적금', tax_treatment: '세금우대' },
  // 일반 (General)
  { name: '일반위탁계좌', tax_treatment: '일반' },
  { name: 'CMA', tax_treatment: '일반' },
  { name: '해외주식 위탁계좌', tax_treatment: '일반' },
  { name: '예금', tax_treatment: '일반' },
  { name: '적금', tax_treatment: '일반' },
  // 연금 (Pension)
  { name: '연금저축계좌', tax_treatment: '연금' },
  { name: 'IRP (개인형퇴직연금)', tax_treatment: '연금' },
  { name: '퇴직연금 DC', tax_treatment: '연금' },
  { name: '퇴직연금 DB', tax_treatment: '연금' },
] as const
```

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/account-types` | List all account types | `ApiResponse<AccountType[]>` |
| POST | `/api/account-types` | Create new account type | `ApiResponse<AccountType>` (201) or 400/409 |
| PUT | `/api/account-types/:id` | Update account type (partial) | `ApiResponse<AccountType>` or 404/409 |
| DELETE | `/api/account-types/:id` | Delete account type | `ApiResponse<null>` (200) or 404 |

Note on PUT semantics: This uses PUT path but applies partial-update (PATCH) semantics by design, consistent with PRD-FEAT-001 and PRD-FEAT-002 patterns. Omitted optional fields retain their current values. `updated_at` is always set to current timestamp on successful update.

Note on uniqueness error handling: Route handlers MUST catch PostgreSQL unique violation error (code `23505`) and return 409 with a user-friendly error message (`'이미 등록된 계좌유형입니다.'`). When FK constraints are introduced (future accounts PRD), DELETE route MUST also catch `23503` (foreign key violation) and return 409.

Note on repository contract: Route handler MUST check: if `repo.update()` returns `undefined`, respond 404. If `repo.delete()` returns `false`, respond 404. Other exceptions bubble to the global error handler as 500.

### Repository (src/server/database/account-type-repository.ts)
```typescript
export class AccountTypeRepository {
  constructor(private readonly db: Database) {}
  findAll(): Promise<readonly AccountType[]>
  findById(id: number): Promise<AccountType | undefined>
  create(input: CreateAccountTypePayload): Promise<AccountType>
  update(id: number, input: UpdateAccountTypePayload): Promise<AccountType | undefined>
  delete(id: number): Promise<boolean>
  count(): Promise<number>
  seed(): Promise<void>  // Insert default account types if table is empty
}
```

### Input Validation (Zod)
```typescript
const createAccountTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  tax_treatment: z.enum(['세금우대', '일반', '연금']).optional(),
})

const updateAccountTypeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  tax_treatment: z.enum(['세금우대', '일반', '연금']).optional(),
}).strict().refine(data => data.name !== undefined || data.tax_treatment !== undefined, {
  message: 'At least one field must be provided',
})
```

### Frontend Components
- `features/settings/AccountTypeView.tsx` — 계좌유형 관리 페이지 (테이블 + 세금처리 필터 + 모달 연결)
- `features/settings/components/AccountTypeTable.tsx` — 계좌유형 목록 테이블
- `features/settings/components/AccountTypeFormModal.tsx` — 생성/수정 폼 모달. Receives optional `accountType?: AccountType` prop. If present, title is "계좌유형 수정" and fields are pre-populated; if absent, title is "계좌유형 추가" and fields are empty. Fields: name → tax_treatment, CTA: "저장"
- `features/settings/components/AccountTypeDeleteModal.tsx` — 삭제 확인 모달
- `features/settings/use-account-types.ts` — API wrapping hook (colocated in feature)
- Route: `/account-types` with nav item in `navigation.ts` (label: '계좌유형', icon: Landmark), following the standalone page pattern from PRD-FEAT-001/002
- States: empty (EmptyState component), loading (Spinner), error (Alert), success (account type list table)
- Delete confirmation: existing Modal component with title "계좌유형 삭제", body "'{name}'을(를) 삭제하시겠습니까?", primary action "삭제", secondary action "취소"
- Data refresh: On successful POST/PUT/DELETE, `useAccountTypes` calls `queryClient.invalidateQueries({ queryKey: ACCOUNT_TYPES_KEY })` to trigger a re-fetch — consistent with the `useInstitutions` pattern
- Modal error feedback: On 400 or 409 response, the modal remains open and displays an inline error message below the form. The "저장" button shows a loading spinner during submission and is disabled to prevent double-submit

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (`account_types` table) + migration + shared types | Low |
| 2 | Repository tests (RED) + `AccountTypeRepository` implementation (GREEN) + seed logic | Medium |
| 3 | API route tests (RED) + Hono routes with Zod validation (GREEN) | Medium |
| 4 | Client: `api.accountTypes` + `useAccountTypes` hook + hook tests | Low |
| 5a | Client: `AccountTypeView` skeleton + `AccountTypeTable` + tax treatment filter | Medium |
| 5b | Client: `AccountTypeFormModal` + `AccountTypeDeleteModal` + Settings integration | Medium |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

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

---

## 8. Dependencies

- PRD-FEAT-001 (Family Member Management) — UI 패턴 참조 (Settings 섹션, 테이블+필터+모달)
- PRD-FEAT-002 (Institution Management) — 동일 CRUD 패턴, seed 로직 참조
- Reuses existing UI components: Modal, Input, Select, Button, Card, EmptyState, Spinner, Alert

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Name uniqueness conflict | Low | UNIQUE constraint + 409 response on both POST and PUT |
| Tax treatment free text vs enum | Low | Zod enum validation on input, text storage for flexibility |
| Future account FK delete constraint | Medium | Deferred to accounts PRD; catch `23503` and return 409 when implemented |
| PostgreSQL connection pool exhaustion | Low | Connection pool configured via DB_POOL_MAX |
| Seed data conflicts on re-run | Low | Only seed when table is empty (`count() === 0`) |
| Seed inserts within single transaction | Low | Wrap seed in single transaction — no partial seed on failure |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-12 | 1.0 | - | Initial PRD for money-bus-v3, adapted from v1 account type management for PostgreSQL + Drizzle ORM stack. Follows PRD-FEAT-002 patterns. |
