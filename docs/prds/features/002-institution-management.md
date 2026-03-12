---
type: prd
prd-id: PRD-FEAT-002
prd-type: feature
title: Institution Management (금융기관 관리)
status: approved
implementation-status: not-started
created: 2026-03-12
updated: 2026-03-12
author: -
tags: [prd, institution, settings, crud, master-data]
---

# Feature: Institution Management (금융기관 관리)

## 1. Overview

금융기관(증권사, 은행, 자산운용사) 마스터 데이터를 관리하는 설정 기능이다.

계좌나 상품 생성 시 소속 금융기관을 자유 텍스트로 입력하면 "삼성증권"/"삼성 증권" 등 표기 불일치 문제가 발생한다. 금융기관 목록을 별도 테이블로 관리하여 일관성을 확보하고, 향후 계좌/상품 폼에서 드롭다운 선택으로 전환할 수 있는 기반을 마련한다.

v1(PRD-FEAT-001)에서 검증된 기능을 v3 스택(PostgreSQL + Drizzle ORM)으로 마이그레이션하며, 가족구성원 관리(PRD-FEAT-001)와 동일한 CRUD 패턴을 따른다.

**Core Value:**
- 금융기관 목록을 한 곳에서 관리
- 기관명 표기 일관성 확보
- 한국 주요 금융기관 시드 데이터 25개 제공
- 향후 계좌/상품 폼에서 드롭다운 선택으로 전환 가능

---

## 2. User Stories

- As a user, I want to view a list of all registered financial institutions so I can see which institutions are available.
- As a user, I want to add a new institution (e.g., a new brokerage I opened an account at).
- As a user, I want to update an institution's name or category to fix mistakes.
- As a user, I want to delete an institution I no longer use.
- As a user, I want default Korean institutions pre-loaded so I don't have to enter them manually.

---

## 3. Scope

### In Scope
- PostgreSQL `institutions` table (Drizzle schema + migration)
- `InstitutionRepository` (Drizzle ORM)
- Hono REST API routes (GET/POST/PUT/DELETE /api/institutions)
- Shared TypeScript types (`Institution`, `CreateInstitutionPayload`, `UpdateInstitutionPayload`)
- Default seed data (25 Korean institutions: 10 securities, 5 banks, 10 asset managers)
- `useInstitutions` custom hook (client)
- `InstitutionView` component under Settings view
- Category filter (전체/증권/은행/운용사)
- Delete confirmation via existing Modal component
- Input validation via Zod

### Out of Scope
- 기관과 계좌/상품 간 FK 연결 (계좌/상품 PRD에서 처리)
- 기관 로고/아이콘 관리
- 기관 코드(code) 필드 (향후 필요 시 추가)
- 기관 정렬 순서 커스터마이징

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View institution list | Given institutions in DB, when user calls GET /api/institutions, then all institutions are returned sorted by name ASC. UI shows table with name, category columns. Empty state shown when no institutions exist. Loading spinner shown during fetch. Optional `?category=증권` query param filters by category. |
| 2 | Add institution | Given user enters name and category, when they POST /api/institutions, then a new row is created (201). Invalid input returns 400 with Zod validation error. Duplicate name returns 409. Modal closes on success and list refreshes. On 400 or 409 response, the modal remains open and displays an inline error message below the form (e.g., '이미 등록된 기관명입니다.'). |
| 3 | Update institution | Given an existing institution, when user sends PUT /api/institutions/:id with partial fields, then only provided fields are updated. `updated_at` is explicitly set to current timestamp. Non-existent ID returns 404. Duplicate name (different id) returns 409. Empty body `{}` returns 400 ("At least one field must be provided"). On error, the modal remains open and shows an inline error message. |
| 4 | Delete institution | Given an existing institution, when user clicks delete, a confirmation Modal appears ("금융기관 삭제", "'{name}'을(를) 삭제하시겠습니까?", confirm/cancel buttons). On confirm, DELETE /api/institutions/:id removes the row. Non-existent ID returns 404. |
| 5 | Default seed data | Given first launch, when institutions table is empty, then 25 Korean institutions are seeded automatically. Seed runs at server startup in `src/server/index.ts`, after `runMigrations()`, before serving requests. If `count() === 0`, call `repo.seed()` within a single transaction. |
| 6 | Category filter | Given institutions with mixed categories, when user selects a category filter, then only matching institutions are displayed. When user selects '전체', no `?category=` query param is sent and the client renders the full list from the initial fetch. |

---

## 5. Technical Design

### Architecture
```
Client (React)                     Server (Hono)
─────────────────                  ──────────────────
SettingsView                       Hono Routes
  └─ InstitutionView                 └─ /api/institutions
       └─ useInstitutions                 └─ InstitutionRepository
                                               └─ Drizzle ORM → PostgreSQL
```

### Database Schema (Drizzle)
```typescript
// src/server/database/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  category: text('category').notNull().default('증권'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: `updatedAt` uses `defaultNow()` for INSERT only. The repository `update()` method MUST explicitly set `updatedAt: new Date()` on every update call. Drizzle pg-core does not support `.$onUpdateFn()` — manual setting is required.

### Shared TypeScript Types (src/shared/types.ts)

Field names use snake_case to match the API/DB wire format, consistent with existing types.

```typescript
export interface Institution {
  readonly id: number
  readonly name: string
  readonly category: string
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateInstitutionPayload {
  readonly name: string
  readonly category?: string
}

export interface UpdateInstitutionPayload {
  readonly name?: string
  readonly category?: string
}
```

### Category Options

| Value | Label |
|-------|-------|
| 증권 | 증권 (Securities) |
| 은행 | 은행 (Bank) |
| 운용사 | 운용사 (Asset Manager) |

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/institutions` | List all (optional `?category=` filter) | `ApiResponse<Institution[]>` |
| POST | `/api/institutions` | Create new institution | `ApiResponse<Institution>` (201) or 400/409 |
| PUT | `/api/institutions/:id` | Update institution (partial) | `ApiResponse<Institution>` or 404/409 |
| DELETE | `/api/institutions/:id` | Delete institution | `ApiResponse<null>` (200) or 404 |

Note on PUT semantics: This uses PUT path but applies partial-update (PATCH) semantics by design, consistent with PRD-FEAT-001 patterns. Omitted optional fields retain their current values. `updated_at` is always set to current timestamp on successful update.

Note on uniqueness error handling: Route handlers MUST catch PostgreSQL unique violation error (code `23505`) and return 409 with a user-friendly error message. When FK constraints are introduced (future accounts/products PRDs), DELETE route MUST also catch `23503` (foreign key violation) and return 409.

### Repository (src/server/database/institution-repository.ts)
```typescript
export class InstitutionRepository {
  constructor(private readonly db: Database) {}
  findAll(category?: string): Promise<readonly Institution[]>
  findById(id: number): Promise<Institution | undefined>
  create(input: CreateInstitutionPayload): Promise<Institution>
  update(id: number, input: UpdateInstitutionPayload): Promise<Institution | undefined>
  delete(id: number): Promise<boolean>
  count(): Promise<number>
  seed(): Promise<void>  // Insert default institutions if table is empty
}
```

### Default Seed Data (25 institutions)
```typescript
const DEFAULT_INSTITUTIONS: readonly CreateInstitutionPayload[] = [
  // 증권 (10)
  { name: '삼성증권', category: '증권' },
  { name: 'KB증권', category: '증권' },
  { name: '미래에셋증권', category: '증권' },
  { name: 'NH투자증권', category: '증권' },
  { name: '한국투자증권', category: '증권' },
  { name: '신한투자증권', category: '증권' },
  { name: '키움증권', category: '증권' },
  { name: '대신증권', category: '증권' },
  { name: '토스증권', category: '증권' },
  { name: '카카오페이증권', category: '증권' },
  // 은행 (5)
  { name: '국민은행', category: '은행' },
  { name: '신한은행', category: '은행' },
  { name: '하나은행', category: '은행' },
  { name: '우리은행', category: '은행' },
  { name: '농협은행', category: '은행' },
  // 운용사 (10)
  { name: '삼성자산운용', category: '운용사' },
  { name: '미래에셋자산운용', category: '운용사' },
  { name: 'KB자산운용', category: '운용사' },
  { name: '한국투자신탁운용', category: '운용사' },
  { name: '신한자산운용', category: '운용사' },
  { name: '한화자산운용', category: '운용사' },
  { name: 'NH-Amundi자산운용', category: '운용사' },
  { name: '키움투자자산운용', category: '운용사' },
  { name: '타임폴리오자산운용', category: '운용사' },
  { name: 'KoAct자산운용', category: '운용사' },
] as const
```

### Input Validation (Zod)
```typescript
const createInstitutionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(['증권', '은행', '운용사']).optional(),
})

const updateInstitutionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.enum(['증권', '은행', '운용사']).optional(),
}).strict().refine(data => data.name !== undefined || data.category !== undefined, {
  message: 'At least one field must be provided',
})
```

### Frontend Components
- `features/settings/InstitutionView.tsx` -- 금융기관 관리 페이지 (테이블 + 카테고리 필터 + 모달 연결)
- `features/settings/components/InstitutionTable.tsx` -- 기관 목록 테이블
- `features/settings/components/InstitutionFormModal.tsx` -- 생성/수정 폼 모달. Receives optional `institution?: Institution` prop. If present, title is "금융기관 수정" and fields are pre-populated; if absent, title is "금융기관 추가" and fields are empty. Fields: name -> category, CTA: "저장"
- `features/settings/components/InstitutionDeleteModal.tsx` -- 삭제 확인 모달
- `features/settings/use-institutions.ts` -- API wrapping hook (colocated in feature)
- Settings view에 섹션으로 통합
- States: empty (EmptyState component), loading (Spinner), error (Alert), success (institution list table)
- Delete confirmation: existing Modal component with title "금융기관 삭제", body "'{name}'을(를) 삭제하시겠습니까?", primary action "삭제", secondary action "취소"
- Data refresh: On successful POST/PUT/DELETE, `useInstitutions` calls `queryClient.invalidateQueries({ queryKey: INSTITUTIONS_KEY })` to trigger a re-fetch — consistent with the `useFamilyMembers` pattern
- Modal error feedback: On 400 or 409 response, the modal remains open and displays an inline error message below the form (e.g., '이미 등록된 기관명입니다.'). The "저장" button shows a loading spinner during submission and is disabled to prevent double-submit

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (institutions table) + migration + shared types | Low |
| 2 | Repository tests (RED) + InstitutionRepository implementation (GREEN) + seed logic | Medium |
| 3 | API route tests (RED) + Hono routes with Zod validation (GREEN) | Medium |
| 4 | Client: api.institutions + useInstitutions hook + hook tests | Low |
| 5a | Client: InstitutionView skeleton + InstitutionTable + category filter | Medium |
| 5b | Client: InstitutionFormModal + InstitutionDeleteModal + Settings integration | Medium |

Note: Follows mandatory TDD workflow -- tests are written before implementation within each wave (RED -> GREEN -> REFACTOR).

---

## 7. Success Metrics

- [ ] Institution CRUD works end-to-end (API -> DB -> UI)
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

---

## 8. Dependencies

- PRD-FEAT-001 (Family Member Management) -- UI 패턴 참조 (Settings 섹션, 테이블+필터+모달)
- Reuses existing UI components: Modal, Input, Select, Button, Card, EmptyState, Spinner, Alert

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Name uniqueness conflict | Low | UNIQUE constraint + 409 response on both POST and PUT |
| Category free text vs enum | Low | Zod enum validation on input, text storage for flexibility |
| Future account/product FK delete constraint | Medium | Deferred to accounts/products PRD; no constraint in this PRD |
| PostgreSQL connection pool exhaustion | Low | Connection pool configured via DB_POOL_MAX |
| Seed data conflicts on re-run | Low | Only seed when table is empty (`count() === 0`) |
| 25 simultaneous inserts during seed | Low | Wrap seed in single transaction |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-12 | 1.0 | - | Initial PRD for money-bus-v3, adapted from v1 PRD-FEAT-001 for PostgreSQL + Drizzle ORM stack. Added PUT endpoint, Zod validation, category filter, updated_at field. |
| 2026-03-12 | 1.1 | - | Fix review: empty PUT body validation (refine), seed trigger timing, FK violation handling note, PATCH semantics clarification, FormModal prop spec, seed transaction metric |
| 2026-03-12 | 1.2 | - | PRD review fixes: refetch→invalidateQueries (CRITICAL), modal error feedback for Stories 2/3 (HIGH), strict Zod update schema (HIGH), split Wave 5 into 5a/5b (HIGH) |
