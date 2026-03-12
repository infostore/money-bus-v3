---
type: prd
prd-id: PRD-FEAT-001
prd-type: feature
title: Family Member Management (가족 구성원 관리)
status: approved
implementation-status: completed
created: 2026-03-12
updated: 2026-03-12
author: -
tags: [prd, family, member, settings, crud]
---

# Feature: Family Member Management (가족 구성원 관리)

## 1. Overview

자산을 관리할 가족 구성원을 등록하고 관리하는 기능이다.

각 구성원은 이름, 관계(본인/배우자/자녀/부모/기타), 출생연도를 갖는다. 향후 계좌는 가족 구성원에 귀속되며, 구성원별 자산 현황을 조회하는 기반이 된다.

v3는 단일 사용자 웹 앱이므로 인증/멀티유저 없이 PostgreSQL 데이터로 관리한다.

**Core Value:**
- 가족 구성원 등록 및 관리 (CRUD)
- 구성원별 관계 유형 분류
- 향후 계좌/자산의 소유주 귀속 기반
- 구성원별 포트폴리오 조회 기반

---

## 2. User Stories

- As a user, I want to register family members so I can track assets per person.
- As a user, I want to view all family members with their relationship and birth year.
- As a user, I want to update family member information to keep records accurate.
- As a user, I want to delete a family member I no longer need to track.

---

## 3. Scope

### In Scope
- PostgreSQL `family_members` table (Drizzle schema + migration)
- `FamilyMemberRepository` (Drizzle ORM)
- Hono REST API routes (GET/POST/PUT/DELETE /api/family-members)
- Shared TypeScript types (`FamilyMember`, `CreateFamilyMemberPayload`, `UpdateFamilyMemberPayload`)
- `useFamilyMembers` custom hook (client)
- `FamilyMemberView` component under Settings view
- Relationship dropdown (본인/배우자/자녀/부모/기타)
- Delete confirmation via existing Modal component

### Out of Scope
- 멀티유저 인증 (v3는 단일 사용자)
- 구성원 프로필 이미지
- 구성원별 자산 합산 표시 (계좌 PRD 구현 후 연동)
- 구성원별 대시보드 필터 (별도 PRD)
- Seed data (사용자가 직접 등록)
- Delete constraint for linked accounts (future: when accounts table exists, add FK check before delete)

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View family members | Given members in DB, when user calls GET /api/family-members, then all members are returned sorted by id ASC. UI shows table with name, relationship, birth_year columns. Empty state (EmptyState component) shown when no members exist. Loading spinner shown during fetch. |
| 2 | Add family member | Given user enters name, relationship, birth_year, when they POST, then a new member row is created (201). Invalid input returns 400 with Zod validation error. Modal closes on success and list refreshes automatically. |
| 3 | Update family member | Given an existing member, when user sends PUT /api/family-members/:id with partial fields, then only provided fields are updated (omitted fields retain current values). `updated_at` is explicitly set to current timestamp. Non-existent ID returns 404. When name conflicts with another member (different id), 409 is returned. A PUT with the same name as the current member (no name change) must not return 409. |
| 4 | Delete family member | Given an existing member, when user clicks delete, a confirmation Modal appears ("구성원 삭제", "'{name}'을(를) 삭제하시겠습니까?", confirm/cancel buttons). On confirm, DELETE /api/family-members/:id removes the row. Non-existent ID returns 404. |
| 5 | Unique name validation | Given an existing name, when user creates or updates to a duplicate name, then 409 is returned. UI shows error message for duplicate name. |

---

## 5. Technical Design

### Architecture
```
Client (React)                     Server (Hono)
─────────────────                  ──────────────────
SettingsView                       Hono Routes
  └─ FamilyMemberView               └─ /api/family-members
       └─ useFamilyMembers               └─ FamilyMemberRepository
                                               └─ Drizzle ORM → PostgreSQL
```

### Database Schema (Drizzle)
```typescript
// src/server/database/schema.ts
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const familyMembers = pgTable('family_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  relationship: text('relationship').notNull().default('본인'),
  birthYear: integer('birth_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: `updatedAt` uses `defaultNow()` for INSERT only. The repository `update()` method MUST explicitly set `updatedAt: new Date()` on every update call. Drizzle ORM does not auto-update timestamps.

### Shared TypeScript Types (src/shared/types.ts)

Field names use snake_case to match the API/DB wire format directly, consistent with existing `ItemData` type.

```typescript
export interface FamilyMember {
  readonly id: number
  readonly name: string
  readonly relationship: string
  readonly birth_year: number | null
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateFamilyMemberPayload {
  readonly name: string
  readonly relationship?: string
  readonly birth_year?: number
}

export interface UpdateFamilyMemberPayload {
  readonly name?: string
  readonly relationship?: string
  readonly birth_year?: number
}
```

### Relationship Options

| Value | Label |
|-------|-------|
| 본인 | 본인 (Self) |
| 배우자 | 배우자 (Spouse) |
| 자녀 | 자녀 (Child) |
| 부모 | 부모 (Parent) |
| 기타 | 기타 (Other) |

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/family-members` | List all family members | `ApiResponse<FamilyMember[]>` |
| POST | `/api/family-members` | Create new member | `ApiResponse<FamilyMember>` (201) or 400/409 |
| PUT | `/api/family-members/:id` | Update member (partial) | `ApiResponse<FamilyMember>` or 404/409 |
| DELETE | `/api/family-members/:id` | Delete member | `ApiResponse<null>` (200) or 404 |

Note on PUT semantics: PUT replaces only the fields present in the request body. Omitted optional fields retain their current values. This is effectively PATCH behavior via PUT for simplicity. `updated_at` is always set to current timestamp on successful update.

Note on DELETE response: Returns `ApiResponse<null>` with `{ success: true, data: null, error: null }` on success, consistent with the pattern where the HTTP 200 status indicates success.

Note on uniqueness error handling: Route handlers MUST catch PostgreSQL unique violation error (code `23505`) and return 409 with a user-friendly error message. This applies to both POST and PUT endpoints. Without this, the UNIQUE constraint violation surfaces as an unhandled 500.

### Repository (src/server/database/family-member-repository.ts)
```typescript
export class FamilyMemberRepository {
  constructor(private readonly db: Database) {}
  findAll(): Promise<FamilyMember[]>
  findById(id: number): Promise<FamilyMember | undefined>
  create(input: CreateFamilyMemberPayload): Promise<FamilyMember>
  update(id: number, input: UpdateFamilyMemberPayload): Promise<FamilyMember | undefined>
  delete(id: number): Promise<boolean>
}
```

Note: `findById` and `update` return `undefined` (not `null`) when the record does not exist, consistent with project conventions.

### Frontend Components
- `features/settings/FamilyMemberView.tsx` — 구성원 관리 페이지 (테이블 + 모달 연결)
- `features/settings/components/FamilyMemberTable.tsx` — 구성원 목록 테이블
- `features/settings/components/FamilyMemberFormModal.tsx` — 생성/수정 폼 모달 (title: "구성원 추가" / "구성원 수정", fields: name → relationship → birth_year, CTA: "저장")
- `features/settings/components/FamilyMemberDeleteModal.tsx` — 삭제 확인 모달
- `features/settings/use-family-members.ts` — API wrapping hook (colocated in feature)
- Settings view에 섹션으로 통합
- States: empty (EmptyState component), loading (Spinner), error (Alert), success (member list table)
- Delete confirmation: existing Modal component with title "구성원 삭제", body "'{name}'을(를) 삭제하시겠습니까?", primary action "삭제", secondary action "취소"
- Data refresh: On successful POST/PUT/DELETE, `useFamilyMembers` calls `refetch()` to re-fetch the full list from the server (no optimistic updates)

### Input Validation (Zod)
```typescript
const createFamilyMemberSchema = z.object({
  name: z.string().trim().min(1).max(50),
  relationship: z.enum(['본인', '배우자', '자녀', '부모', '기타']).optional(),
  birth_year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
})
```

Note: Zod enum validates input; database stores as text for forward compatibility with new relationship types. `birth_year` max is dynamically set to the current year.

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (family_members table) + migration + shared types | Low |
| 2 | Repository tests (RED) + FamilyMemberRepository implementation (GREEN) | Medium |
| 3 | API route tests (RED) + Hono routes with Zod validation (GREEN) | Medium |
| 4 | Client: api.familyMembers + useFamilyMembers hook + hook tests | Low |
| 5 | Client: FamilyMemberView + delete confirmation modal + Settings integration | Medium |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] Family member CRUD works end-to-end (API → DB → UI)
- [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
- [ ] POST validates name uniqueness (409 on duplicate)
- [ ] PUT validates name uniqueness against other members (409 on duplicate)
- [ ] POST returns 400 for invalid input (Zod validation)
- [ ] DELETE returns 404 for non-existent ID
- [ ] GET returns empty array when no members exist
- [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
- [ ] Settings UI shows family member management with create/edit modal
- [ ] Delete confirmation modal appears before deletion
- [ ] UI displays empty state, loading spinner, and error feedback

---

## 8. Dependencies

- None (first domain entity in v3)
- Reuses existing UI components: Modal, Input, Select, Button, Card, EmptyState, Spinner, Alert

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Name uniqueness conflict | Low | UNIQUE constraint + 409 response on both POST and PUT |
| Relationship free text vs enum | Low | Zod enum validation on input, text storage for flexibility |
| Future account FK delete constraint | Medium | Deferred to accounts PRD; no constraint in this PRD |
| PostgreSQL connection pool exhaustion | Low | Connection pool configured via DB_POOL_MAX |
| Deleting 본인 member | Low | No restriction in v1; consider warning when accounts PRD adds FK |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-12 | 1.0 | - | Initial PRD for money-bus-v3, adapted from v1 PRD-FEAT-004 for Hono + PostgreSQL + Drizzle stack |
| 2026-03-12 | 1.1 | - | Fix review issues: null→undefined returns, snake_case fields, remove Story 6, add UI criteria, withTimezone, client hook tests |
| 2026-03-12 | 1.2 | - | Fix review round 2: explicit partial-update PUT semantics, delete confirmation Modal UX, updatedAt manual set note, PUT 409 for name conflict, TDD wave ordering, DELETE returns ApiResponse<null>, birth_year max dynamic |
| 2026-03-12 | 1.3 | - | Fix review round 3: PostgreSQL 23505 error handling note, refetch mechanism, dynamic birth_year max |
| 2026-03-12 | 1.4 | - | Fix review round 4: trim() on name, component subdirectory structure, self-update uniqueness clarification |
