---
type: pdca-plan
plan-name: Product Management
related-prd: PRD-FEAT-004
phase: act
status: completed
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
  - [x] Wave 1-A: Add `Product`, `CreateProductPayload`, `UpdateProductPayload` to `src/shared/types.ts`
  - [x] Wave 1-B: Add `products` table to `src/server/database/schema.ts`
  - [x] Wave 1-C: Generate Drizzle migration (0005_daily_nicolaos.sql)

  ### Wave 2 — Repository
  - [x] Wave 2-A: Write `ProductRepository` unit tests (22 tests)
  - [x] Wave 2-B: Implement `ProductRepository` with seed (15 default products)
  - [x] Wave 2-C: Wire seed call in `src/server/index.ts`

  ### Wave 3 — Server Routes
  - [x] Wave 3-A: Write Hono route integration tests (20 tests)
  - [x] Wave 3-B: Implement `createProductRoutes` with Zod validation
  - [x] Wave 3-C: Register `/api/products` route

  ### Wave 4 — Client Hook
  - [x] Wave 4-A: Add `productsApi` to `src/client/src/lib/api.ts`
  - [x] Wave 4-B: Implement `useProducts` hook with TanStack Query

  ### Wave 5a — View & Table
  - [x] Wave 5a-A: Implement `ProductTable` component
  - [x] Wave 5a-B: Implement `ProductView` with asset type filter

  ### Wave 5b — Modals & Integration
  - [x] Wave 5b-A: Implement `ProductFormModal` (create/edit)
  - [x] Wave 5b-B: Implement `ProductDeleteModal`
  - [x] Wave 5b-C: Wire `/products` route in `routes/assets.ts`

- **Progress Log**:
  - 2026-03-12: PDCA plan created
  - 2026-03-12: Transitioned to DO phase — starting implementation
  - 2026-03-12: All waves completed — 148 tests passing, 85.85% coverage
  - 2026-03-12: Transitioned to ACT phase — completed

## Check

- **Results**:
  - All 148 tests pass (42 product-specific + 106 existing)
  - Coverage: 85.85% stmts, 82.14% branches, 93.05% funcs, 85.85% lines (all > 80%)
  - TypeScript compiles cleanly (npx tsc --noEmit)

- **Evidence**:
  - `npx vitest run --coverage` — 8 test files, 148 tests, 0 failures
  - product-repository.ts: 100% coverage
  - products.ts routes: 88.57% coverage

## Act

- **Learnings**:
  1. Same-millisecond timestamp comparison can cause flaky tests — use small delay for updatedAt assertions
  2. Products route is in assets group (navigation.ts) not settings group, matching nav structure

- **Next Actions**:
  1. Future: Connect products to holdings via FK (holdings PRD)
  2. Future: Price API integration for real-time quotes
