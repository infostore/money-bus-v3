---
type: pdca-plan
plan-name: Product Management
related-prd: PRD-FEAT-004
phase: do
status: in-progress
created: 2026-03-12
updated: 2026-03-12
tags: [pdca, product, instrument, settings, crud, master-data]
---

# PDCA Plan: Product Management

## Plan

- **Goal**: Implement full CRUD for financial instrument (종목) management — Drizzle schema through Settings UI — including 15 Korean/US default products, asset type filtering, and Zod-validated API endpoints.

- **Scope**:
  - Wave 1: Shared types + Drizzle schema (`products` table) + migration
  - Wave 2: `ProductRepository` tests (RED) + implementation (GREEN) + seed logic (15 products, single transaction)
  - Wave 3: Hono route tests (RED) + routes with Zod validation (GREEN) — GET/POST/PUT/DELETE, 409 on pg unique violation 23505
  - Wave 4: Client `api.products` module + `useProducts` hook (TanStack Query)
  - Wave 5a: `ProductView` skeleton + `ProductTable` + asset type filter (client-side useMemo)
  - Wave 5b: `ProductFormModal` + `ProductDeleteModal` + Settings nav integration

- **Success Metrics**:
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

## Do

- **Tasks**:

  ### Wave 1 — Foundation
  - [ ] Wave 1-A: Add `Product`, `CreateProductPayload`, `UpdateProductPayload` to `src/shared/types.ts` — Low
  - [ ] Wave 1-B: Add `products` table to `src/server/database/schema.ts` (Drizzle pgTable: serial PK, name unique text, code nullable text, asset_type text default '기타', currency text default 'KRW', exchange nullable text, timestamps) — Low
  - [ ] Wave 1-C: Generate and apply Drizzle migration (`npm run db:generate && npm run db:migrate`) — Low

  ### Wave 2 — Repository
  - [ ] Wave 2-A: Write `ProductRepository` unit tests (RED) — findAll (sorted name ASC), findById, create, update (explicit updatedAt), delete (returns bool), count, seed, uniqueness constraints — Medium
  - [ ] Wave 2-B: Implement `ProductRepository` in `src/server/database/product-repository.ts` (GREEN + REFACTOR) including `seed()` with 15 default products in a single transaction — Medium
  - [ ] Wave 2-C: Wire seed call in `src/server/index.ts` after `runMigrations()` — call `productRepo.seed()` only when `count() === 0` — Low

  ### Wave 3 — Server Routes
  - [ ] Wave 3-A: Write Hono route integration tests (RED) — GET (list sorted), POST (201/400/409), PUT (200/400/404/409/empty-body/same-name-no-409), DELETE (200/404), pg error 23505 → 409 — Medium
  - [ ] Wave 3-B: Implement `createProductRoutes` in `src/server/routes/products.ts` with Zod validation, pg unique violation (23505) → 409 ('이미 등록된 종목입니다.') handling (GREEN + REFACTOR) — Medium
  - [ ] Wave 3-C: Register `/api/products` route in `src/server/index.ts` — Low

  ### Wave 4 — Client Hook
  - [ ] Wave 4-A: Add `productsApi` to `src/client/src/lib/api.ts` (list, create, update, delete) — Low
  - [ ] Wave 4-B: Implement `useProducts` hook in `src/client/src/features/settings/use-products.ts` using TanStack Query (`invalidateQueries` on mutation success, `PRODUCTS_KEY`) — Low

  ### Wave 5a — View & Table
  - [ ] Wave 5a-A: Implement `ProductTable` component in `src/client/src/features/settings/components/ProductTable.tsx` (name, code, asset_type, currency, exchange columns; edit/delete action buttons) — Medium
  - [ ] Wave 5a-B: Implement `ProductView` in `src/client/src/features/settings/ProductView.tsx` with asset type filter tabs (전체/주식/ETF/펀드/채권/예적금/암호화폐/기타 via useMemo), empty state ('해당 자산 유형의 종목이 없습니다.' for filtered, generic for no data), loading spinner, error Alert — Medium

  ### Wave 5b — Modals & Integration
  - [ ] Wave 5b-A: Implement `ProductFormModal` in `src/client/src/features/settings/components/ProductFormModal.tsx` (create/edit dual mode via optional `product?` prop; fields: name → code → asset_type → currency → exchange; inline error on 400/409; loading spinner on submit; disabled double-submit) — Medium
  - [ ] Wave 5b-B: Implement `ProductDeleteModal` in `src/client/src/features/settings/components/ProductDeleteModal.tsx` (title: '종목 삭제', body: ''{name}'을(를) 삭제하시겠습니까?', confirm '삭제', cancel '취소') — Low
  - [ ] Wave 5b-C: Add `/products` route to `routes/settings.ts` (or relevant domain file) and nav item (label: '종목 관리', icon: Package) to `navigation.ts` — Low

- **Progress Log**:
  - 2026-03-12: PDCA plan created
  - 2026-03-12: Transitioned to DO phase — starting implementation

## Check

- **Results**:
  - [Result 1]

- **Evidence**:
  - [Verification evidence]

## Act

- **Learnings**:
  1. [Learning 1]

- **Next Actions**:
  1. [Next action 1]
