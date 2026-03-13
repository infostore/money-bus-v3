---
type: pdca-plan
plan-name: ETF Detail Page
related-prd: PRD-FEAT-007
phase: do
status: in-progress
created: 2026-03-13
updated: 2026-03-13

tags: [pdca, etf, product, detail, price-history, chart, recharts]
---

# PDCA Plan: ETF Detail Page

## Plan

- **Goal**: Implement the `/products/:id` detail page with product metadata header, price summary card, and Recharts line chart with time range selection — powered by two new API endpoints (`GET /api/products/:id` and `GET /api/products/:id/price-history`).

- **Scope**:
  - Wave 1: Server — new `GET /api/products/:id` endpoint + `PriceHistoryRepository.findByProductIdInRange()` + `GET /api/products/:id/price-history` endpoint with date-range query params
  - Wave 2: Server tests — repository unit tests (RED → GREEN) + route integration tests for both endpoints (200/404/400 cases)
  - Wave 3: Client utilities — `price-history-utils.ts` pure functions + unit tests (52W calc, range-to-date, latest close)
  - Wave 4: Client data layer — `api.products.getById()` + `api.products.getPriceHistory()` in `lib/api.ts` + `useProductDetail` hook
  - Wave 5: Client UI — `ProductDetailPage`, `ProductDetailHeader`, `PriceSummaryCard` with loading/error/empty states
  - Wave 6: Client chart — install `recharts`, implement `PriceHistoryChart` with `RangeSelector` buttons
  - Wave 7: Routing + navigation wiring — add `productDetailRoute` to `assets.ts`, update `ProductTable` with `onDetail` prop, wire in `ProductView`

- **Success Metrics**:
  - [ ] Clicking a product row in `/products` navigates to `/products/:id`
  - [ ] `GET /api/products/:id` returns 200 with correct product data
  - [ ] `GET /api/products/:id` returns 404 with `{ success: false, data: null, error: 'Product not found' }` for non-existent ID
  - [ ] `GET /api/products/:id/price-history` returns 200 with all rows when no params supplied
  - [ ] `GET /api/products/:id/price-history?from=2025-01-01&to=2025-12-31` returns only rows within range
  - [ ] `GET /api/products/:id/price-history?from=invalid` returns 400
  - [ ] Product detail header displays name, code, exchange, currency, and asset_type badges
  - [ ] Price summary card shows latest close, 52-week high, 52-week low, and data coverage period
  - [ ] Price history line chart renders with date on x-axis and close price on y-axis
  - [ ] Chart time range selector (1M / 3M / 6M / 1Y / 전체) is functional; active range is visually highlighted
  - [ ] Switching range triggers a new query with updated `from` param; chart updates accordingly
  - [ ] Default chart range on page load is 1Y
  - [ ] No price data: chart area shows EmptyState '수집된 가격 데이터가 없습니다.' without JS errors
  - [ ] Non-existent product ID: page shows Alert '종목을 찾을 수 없습니다.' with '목록으로 돌아가기' button
  - [ ] Back navigation from detail page returns user to `/products`
  - [ ] Tests achieve 80%+ coverage for new server routes, repository method, and client utilities

## Do

- **Tasks**:

  ### Wave 1 — Server: API Endpoints
  - [ ] Add `GET /api/products/:id` route to existing `src/server/routes/products.ts` — returns 200 or 404
  - [ ] Add `PriceHistoryRepository.findByProductIdInRange(productId, from?, to?)` method with optional date-range SQL filter
  - [ ] Add `GET /api/products/:id/price-history` route with `from`/`to` query param parsing and YYYY-MM-DD format validation

  ### Wave 2 — Server Tests (TDD)
  - [ ] Write unit tests for `findByProductIdInRange` (no filter / from only / both params / invalid range returns empty / product not found)
  - [ ] Write integration tests for `GET /api/products/:id` (200 valid, 404 missing, 400 non-numeric id)
  - [ ] Write integration tests for `GET /api/products/:id/price-history` (200 all rows, 200 filtered rows, 400 invalid date format, 404 unknown product)

  ### Wave 3 — Client: Price History Utils
  - [ ] Implement `src/client/src/features/products/price-history-utils.ts` — `getLatestClose`, `get52WeekHigh`, `get52WeekLow`, `getDateRange`, `rangeToFromDate`, `RangeKey` type
  - [ ] Write unit tests for all util functions (empty array edge cases, parseFloat precision, RangeKey date offsets)

  ### Wave 4 — Client: Data Layer
  - [ ] Add `api.products.getById(id)` and `api.products.getPriceHistory(id, from?, to?)` to `src/client/src/lib/api.ts`
  - [ ] Implement `useProductDetail(id, range)` hook in `src/client/src/features/products/use-product-detail.ts` with TanStack Query (three queries: product, chart data, 1Y summary)

  ### Wave 5 — Client: UI Components
  - [ ] Implement `ProductDetailPage.tsx` — top-level route component, reads `$id` param, guards NaN, composes sub-components with loading/error states
  - [ ] Implement `ProductDetailHeader.tsx` — name (large), code/exchange/currency/asset_type badges
  - [ ] Implement `PriceSummaryCard.tsx` — latest close, 52W high/low, data coverage period; empty state for no data

  ### Wave 6 — Client: Chart
  - [ ] Install `recharts` dependency (`npm install recharts`)
  - [ ] Implement `PriceHistoryChart.tsx` — Recharts `LineChart` with `ResponsiveContainer`, `RangeSelector` buttons, date x-axis, close y-axis, custom tooltip; empty state when no data

  ### Wave 7 — Routing & Navigation
  - [ ] Add `productDetailRoute` (`/products/$id`) to `src/client/src/routes/assets.ts` with lazy-loaded `ProductDetailPage`
  - [ ] Update `ProductTable.tsx` with optional `onDetail?: (product: Product) => void` prop and ChevronRight icon button per row
  - [ ] Wire `onDetail` in `ProductView.tsx` using TanStack Router `useNavigate`

- **Progress Log**:
  - 2026-03-13: PDCA plan created
  - 2026-03-13: Phase transition plan → do. Implementation started.

## Check

- **Results**:
  - [To be filled after implementation]

- **Evidence**:
  - [To be filled after implementation]

## Act

- **Learnings**:
  1. [To be filled after implementation]

- **Next Actions**:
  1. [To be filled after implementation]
