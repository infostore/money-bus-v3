---
type: prd
prd-id: PRD-FEAT-004
prd-type: feature
title: Product Management (종목 관리)
status: approved
implementation-status: in-progress
created: 2026-03-12
updated: 2026-03-12
author: -
tags: [prd, product, instrument, settings, crud, master-data]
---

# Feature: Product Management (종목 관리)

## 1. Overview

보유 자산을 기록할 때 종목(금융상품)을 자유 텍스트로 입력하면 "삼성전자"/"삼성전자우"/"005930" 등 표기 불일치 문제가 발생하며, 같은 종목을 여러 가족 구성원이 보유할 때 데이터 일관성이 무너진다. 종목 마스터 테이블을 별도로 관리하여 종목명·코드·자산 유형을 표준화하고, 향후 보유자산 폼에서 종목을 드롭다운으로 선택할 수 있는 기반을 마련한다.

종목 관리 기능은 사용자가 직접 보유하는 주식, ETF, 펀드, 채권, 예금·적금 상품, 암호화폐 등 다양한 금융상품을 등록·수정·삭제할 수 있는 설정 화면을 제공한다. 각 종목은 이름(name), 코드(code, 선택), 자산 유형(asset_type), 통화(currency), 거래소(exchange, 선택) 필드를 가지며 자산 유형별 필터를 지원한다.

v1에서 검증된 종목 관리 기능을 v3 스택(PostgreSQL + Drizzle ORM)으로 마이그레이션한다. PRD-FEAT-001(가족 구성원), PRD-FEAT-002(금융기관), PRD-FEAT-003(계좌유형)과 동일한 Settings CRUD 패턴을 따르며, 자산 유형 필터·시드 데이터·유니크 제약 처리를 포함한다.

**Core Value:**
- 종목 목록을 한 곳에서 관리하여 표기 불일치 해소
- 자산 유형(주식/ETF/펀드/채권/예적금/암호화폐/기타) 기반 분류
- 종목 코드(티커)를 저장하여 향후 시세 API 연동 기반 마련
- 한국·미국 주요 종목 시드 데이터 제공

---

## 2. User Stories

- As a user, I want to view all registered financial instruments so I can see which products are available for portfolio entry.
- As a user, I want to add a new financial instrument (e.g., a stock I recently started holding) so it appears in my instrument list.
- As a user, I want to update an instrument's name, code, or asset type to correct mistakes or outdated information.
- As a user, I want to delete an instrument I no longer hold so the list stays clean.
- As a user, I want to filter instruments by asset type (주식/ETF/펀드/채권/예적금/암호화폐/기타) so I can quickly find what I'm looking for.
- As a user, I want common Korean and US instruments pre-loaded so I don't have to manually enter popular stocks and ETFs.

---

## 3. Scope

### In Scope
- PostgreSQL `products` table (Drizzle schema + migration)
- `ProductRepository` (Drizzle ORM)
- Hono REST API routes (GET/POST/PUT/DELETE `/api/products`)
- Shared TypeScript types (`Product`, `CreateProductPayload`, `UpdateProductPayload`)
- Default seed data (Korean blue-chips, US ETFs, major crypto, common deposit types)
- `useProducts` custom hook (client)
- `ProductView` component under Settings view
- Asset type filter (전체/주식/ETF/펀드/채권/예적금/암호화폐/기타), client-side via `useMemo`
- Delete confirmation via existing Modal component
- Input validation via Zod
- `code` field (nullable, optional) — ticker or ISIN code (e.g., 005930, AAPL, BTC)
- `exchange` field (nullable, optional) — exchange or market (e.g., KOSPI, NYSE, UPBIT)
- `currency` field (default: KRW) — denomination currency

### Out of Scope
- 종목과 보유자산(holding) 간 FK 연결 (보유자산 PRD에서 처리)
- 실시간 시세 조회 및 가격 저장 (시세 연동 PRD에서 처리)
- 종목 정렬 순서 커스터마이징
- 외부 종목 검색 API 연동 (향후 기능)
- 종목별 배당 이력, 분할 이력 관리

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View instrument list | Given instruments in DB, when user calls GET /api/products, then all instruments are returned sorted by name ASC. UI shows table with name, code, asset_type, currency, exchange columns. Empty state shown when no instruments exist. Loading spinner shown during fetch. Optional `?asset_type=주식` query param is accepted but filtering is done client-side. |
| 2 | Add instrument | Given user enters name and asset type, when they POST /api/products, then a new row is created (201). Invalid input returns 400 with Zod validation error. Name comparison is case-sensitive; whitespace is normalized via Zod `.trim()` before insertion. Duplicate name returns 409 ('이미 등록된 종목입니다.'). Duplicate `code` values are permitted (no uniqueness constraint on `code`). Modal closes on success and list refreshes. On 400 or 409, modal remains open with inline error message below the form. |
| 3 | Update instrument | Given an existing instrument, when user sends PUT /api/products/:id with partial fields, then only provided fields are updated. `updated_at` is explicitly set to current timestamp. Non-existent ID returns 404. Duplicate name (different id) returns 409. PUT with same name (no name change) must not return 409. Empty body `{}` returns 400 ('At least one field must be provided'). On error, modal remains open and shows inline error. |
| 4 | Delete instrument | Given an existing instrument, when user clicks delete, a confirmation Modal appears ('종목 삭제', '{name}을(를) 삭제하시겠습니까?', confirm/cancel). On confirm, DELETE /api/products/:id removes the row. Non-existent ID returns 404. On DELETE error, modal closes and Alert error is displayed in ProductView. On future 409 FK violation, display '이 종목은 보유자산에 사용 중이어서 삭제할 수 없습니다.' without closing the modal. |
| 5 | Default seed data | Given first launch, when products table is empty, then default instruments are seeded automatically. Seed runs at server startup in `src/server/index.ts`, after `runMigrations()`, before serving requests. If `count() === 0`, call `repo.seed()` within a single transaction. |
| 6 | Asset type filter | Given instruments with mixed asset types, when user selects a filter, then only matching instruments are displayed. All filtering is done client-side using `useMemo`: `useProducts` always fetches the full list, and filter buttons filter the cached array in memory. When user selects '전체', full list is shown. When the filtered result is empty (no instruments match the selected asset type), display EmptyState with message '해당 자산 유형의 종목이 없습니다.' This matches the `AccountTypeView` tax treatment filter pattern. |

---

## 5. Technical Design

### Architecture
```
Client (React)                     Server (Hono)
─────────────────                  ──────────────────
SettingsView                       Hono Routes
  └─ ProductView                     └─ /api/products
       └─ useProducts                      └─ ProductRepository
                                               └─ Drizzle ORM → PostgreSQL
```

### Database Schema (Drizzle)
```typescript
// src/server/database/schema.ts (addition)
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code'),                                          // nullable, ticker/ISIN
  assetType: text('asset_type').notNull().default('기타'),
  currency: text('currency').notNull().default('KRW'),
  exchange: text('exchange'),                                  // nullable, KOSPI/NYSE/etc.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: `updatedAt` uses `defaultNow()` for INSERT only. The repository `update()` method MUST explicitly set `updatedAt: new Date()` on every update call.

### Shared TypeScript Types (src/shared/types.ts)

Field names use snake_case to match the API/DB wire format, consistent with existing types.

```typescript
// PRD-FEAT-004: Product Management
export interface Product {
  readonly id: number
  readonly name: string
  readonly code: string | null
  readonly asset_type: string
  readonly currency: string
  readonly exchange: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateProductPayload {
  readonly name: string
  readonly code?: string | null
  readonly asset_type?: string
  readonly currency?: string
  readonly exchange?: string | null
}

export interface UpdateProductPayload {
  readonly name?: string
  readonly code?: string | null
  readonly asset_type?: string
  readonly currency?: string
  readonly exchange?: string | null
}
```

### Asset Type Options

| Value | Label |
|-------|-------|
| 주식 | 주식 (Stock) |
| ETF | ETF |
| 펀드 | 펀드 (Fund) |
| 채권 | 채권 (Bond) |
| 예적금 | 예적금 (Deposit/Savings) |
| 암호화폐 | 암호화폐 (Crypto) |
| 기타 | 기타 (Other) |

### Default Seed Data (Korean + US instruments)
```typescript
const DEFAULT_PRODUCTS: readonly CreateProductPayload[] = [
  // 주식 — 국내
  { name: '삼성전자', code: '005930', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'SK하이닉스', code: '000660', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'LG에너지솔루션', code: '373220', asset_type: '주식', currency: 'KRW', exchange: 'KOSPI' },
  // 주식 — 미국
  { name: 'Apple', code: 'AAPL', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'Microsoft', code: 'MSFT', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'NVIDIA', code: 'NVDA', asset_type: '주식', currency: 'USD', exchange: 'NASDAQ' },
  // ETF — 국내
  { name: 'KODEX 200', code: '069500', asset_type: 'ETF', currency: 'KRW', exchange: 'KOSPI' },
  { name: 'TIGER 미국S&P500', code: '360750', asset_type: 'ETF', currency: 'KRW', exchange: 'KOSPI' },
  // ETF — 미국
  { name: 'VOO', code: 'VOO', asset_type: 'ETF', currency: 'USD', exchange: 'NYSE' },
  { name: 'QQQ', code: 'QQQ', asset_type: 'ETF', currency: 'USD', exchange: 'NASDAQ' },
  { name: 'SCHD', code: 'SCHD', asset_type: 'ETF', currency: 'USD', exchange: 'NYSE' },
  // 암호화폐
  { name: '비트코인', code: 'BTC', asset_type: '암호화폐', currency: 'KRW', exchange: 'UPBIT' },
  { name: '이더리움', code: 'ETH', asset_type: '암호화폐', currency: 'KRW', exchange: 'UPBIT' },
  // 예적금
  { name: '정기예금', code: null, asset_type: '예적금', currency: 'KRW', exchange: null },
  { name: '정기적금', code: null, asset_type: '예적금', currency: 'KRW', exchange: null },
] as const
```

### API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/products` | List all products | `ApiResponse<Product[]>` |
| POST | `/api/products` | Create new product | `ApiResponse<Product>` (201) or 400/409 |
| PUT | `/api/products/:id` | Update product (partial) | `ApiResponse<Product>` or 404/409 |
| DELETE | `/api/products/:id` | Delete product | `ApiResponse<null>` (200) or 404 |

Note on PUT semantics: Uses PUT path with partial-update (PATCH) semantics by design, consistent with PRD-FEAT-001/002/003. Omitted optional fields retain their current values. `updated_at` is always set to current timestamp on successful update.

Note on uniqueness error handling: Route handlers MUST catch PostgreSQL unique violation error code `23505` → 409 ('이미 등록된 종목입니다.'). When FK constraints are introduced (future holdings PRD), DELETE route MUST also catch `23503` → 409.

Note on repository contract: If `repo.update()` returns `undefined`, respond 404. If `repo.delete()` returns `false`, respond 404.

### Repository (src/server/database/product-repository.ts)
```typescript
export class ProductRepository {
  constructor(private readonly db: Database) {}
  findAll(): Promise<readonly Product[]>
  findById(id: number): Promise<Product | undefined>
  create(input: CreateProductPayload): Promise<Product>
  update(id: number, input: UpdateProductPayload): Promise<Product | undefined>
  delete(id: number): Promise<boolean>
  count(): Promise<number>
  seed(): Promise<void>  // Insert default products if table is empty
}
```

### Input Validation (Zod)
```typescript
const ASSET_TYPES = ['주식', 'ETF', '펀드', '채권', '예적금', '암호화폐', '기타'] as const

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).nullable().optional(),
  asset_type: z.enum(ASSET_TYPES).optional(),
  currency: z.string().trim().length(3).optional(),   // ISO 4217 e.g. KRW, USD
  exchange: z.string().trim().max(20).nullable().optional(),
})

const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().max(20).nullable().optional(),
  asset_type: z.enum(ASSET_TYPES).optional(),
  currency: z.string().trim().length(3).optional(),
  exchange: z.string().trim().max(20).nullable().optional(),
}).strict().refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: 'At least one field must be provided' },
)
```

### Frontend Components
- `features/settings/ProductView.tsx` — 종목 관리 페이지 (테이블 + 자산유형 필터 + 모달 연결)
- `features/settings/components/ProductTable.tsx` — 종목 목록 테이블 (name, code, asset_type, currency, exchange 컬럼)
- `features/settings/components/ProductFormModal.tsx` — 생성/수정 폼 모달. Optional `product?: Product` prop으로 create/edit 구분. Fields: name → code → asset_type → currency → exchange, CTA: '저장'
- `features/settings/components/ProductDeleteModal.tsx` — 삭제 확인 모달
- `features/settings/use-products.ts` — API wrapping hook (colocated in feature)
- Route: `/products` with nav item in `navigation.ts` (label: '종목 관리', icon: Package) — already registered, following the standalone page pattern from PRD-FEAT-001/002/003
- States: empty (EmptyState), loading (Spinner), error (Alert), success (product list table)
- Delete confirmation: existing Modal component with title '종목 삭제', body ''{name}'을(를) 삭제하시겠습니까?', primary action '삭제', secondary action '취소'
- Data refresh: On successful POST/PUT/DELETE, `useProducts` calls `queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })` — consistent with prior hooks
- Modal error feedback: On 400 or 409, modal remains open with inline error message below the form. '저장' button shows loading spinner during submission and is disabled to prevent double-submit

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Drizzle schema (`products` table) + migration + shared types (`Product`, `CreateProductPayload`, `UpdateProductPayload`) | Low |
| 2 | Repository tests (RED) + `ProductRepository` implementation (GREEN) + seed logic (15 default products, single transaction) | Medium |
| 3 | API route tests (RED) + Hono routes with Zod validation (GREEN) — GET/POST/PUT/DELETE, 409 on unique violation | Medium |
| 4 | Client: `api.products` methods + `useProducts` hook + hook tests | Low |
| 5a | Client: `ProductView` skeleton + `ProductTable` + asset type filter (client-side useMemo) | Medium |
| 5b | Client: `ProductFormModal` + `ProductDeleteModal` + Settings nav integration | Medium |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] Product CRUD works end-to-end (API → DB → UI)
- [ ] Default 15 products seeded on first launch (single transaction, no partial seed on failure)
- [ ] GET /api/products returns list sorted by name ASC
- [ ] Asset type filter works client-side via useMemo (no server-side filtering)
- [ ] POST validates name uniqueness (409 on duplicate, '이미 등록된 종목입니다.')
- [ ] PUT validates name uniqueness against other products (409 on duplicate)
- [ ] PUT with same name (no change) does not return 409
- [ ] PUT updates only provided fields; `updated_at` is explicitly set on every update
- [ ] POST returns 400 for invalid input (Zod validation)
- [ ] PUT returns 400 for empty body `{}`
- [ ] DELETE returns 404 for non-existent ID
- [ ] Tests achieve 80%+ coverage (statements, branches, functions, lines)
- [ ] Settings UI shows product management with create/edit modal
- [ ] Asset type filter works correctly (전체/주식/ETF/펀드/채권/예적금/암호화폐/기타)
- [ ] Delete confirmation modal appears before deletion
- [ ] UI displays empty state, loading spinner, and error feedback
- [ ] `code` and `exchange` fields accept null (optional instrument attributes)

---

## 8. Dependencies

- PRD-FEAT-001 (Family Member Management) — UI 패턴 참조 (Settings 섹션, 테이블+필터+모달)
- PRD-FEAT-002 (Institution Management) — 동일 CRUD 패턴, seed 로직 참조
- PRD-FEAT-003 (Account Type Management) — 자산유형 필터 클라이언트 useMemo 패턴 참조
- Reuses existing UI components: Modal, Input, Select, Button, Card, EmptyState, Spinner, Alert
- Future dependency: 보유자산(holding) PRD — `products.id` FK will be referenced from holdings table

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Name uniqueness conflict | Low | UNIQUE constraint on `products.name` + 409 response on POST and PUT |
| `code` field collisions (same ticker, different exchanges) | Low | `code` is optional and not unique — uniqueness is on `name` only |
| Asset type enum rigidity | Low | Zod enum validation on input; stored as text for future flexibility |
| Future holdings FK delete constraint | Medium | Deferred to holdings PRD; catch pg error `23503` → 409 when implemented |
| Seed data volume (15 rows) | Low | Single transaction seed; only when `count() === 0` |
| Partial seed on failure | Low | Entire seed wrapped in one transaction — all-or-nothing |
| Currency field format inconsistency | Low | Zod `.length(3)` enforces ISO 4217 3-letter code |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-12 | 1.0 | - | Initial PRD for money-bus-v3, adapted from v1 product management for PostgreSQL + Drizzle ORM stack. Follows PRD-FEAT-003 patterns. |
