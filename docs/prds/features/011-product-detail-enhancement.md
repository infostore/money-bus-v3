---
type: prd
prd-id: PRD-FEAT-011
prd-type: feature
title: Product Detail Enhancement (종목 상세 페이지 고도화)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, product, detail, etf, ohlcv, price-table, tabs]
---

# Feature: Product Detail Enhancement (종목 상세 페이지 고도화)

## 1. Overview

PRD-FEAT-007(ETF 상세 페이지)에서 `/products/:id` 경로에 기본 상세 페이지를 구현했다: 종목 메타 헤더, 가격 요약 카드(최근 종가·52주 최고/최저·데이터 기간), 종가 라인 차트. 그러나 `price_history` 테이블에는 OHLCV(시가·고가·저가·종가·거래량) 데이터가 모두 저장되어 있음에도 불구하고 사용자는 종가만 볼 수 있고, 개별 날짜의 시가·고가·저가·거래량을 조회할 방법이 없다. v1의 `EtfDetailView`는 8개 탭으로 데이터를 구조화했으며, 그 중 가격 히스토리 테이블 탭이 사용자에게 특히 유용했다.

이 PRD는 기존 상세 페이지를 고도화하여 세 가지 개선을 적용한다. (1) 탭 기반 레이아웃: 현재 단일 스크롤 구조를 "가격 차트" 탭과 "가격 데이터" 탭으로 분리해 각 뷰를 명확히 구분한다. (2) OHLCV 가격 테이블 탭: 날짜별 시가·고가·저가·종가·거래량을 테이블로 표시하고, 날짜 기준 내림차순 정렬(최신 날짜가 상단)과 페이지네이션을 제공한다. (3) 가격 요약 카드 강화: 현재는 최근 종가·52주 최고/최저·데이터 기간만 표시하는데, 최신 거래일의 시가·고가·저가와 거래량을 추가 통계로 표시하여 하루 단위 가격 흐름을 즉시 파악하게 한다.

ETF 프로파일(섹터, 운용사, 총보수율 등)과 구성 종목 추적은 새로운 스키마와 외부 데이터 소스가 필요하므로 이 PRD의 범위에서 제외하고 이후 PRD에서 다룬다. 분배금 이력도 별도 스키마가 필요하므로 제외한다. 이 PRD는 **기존 `price_history` 테이블의 데이터만 활용**하므로 스키마 변경 없이 구현 가능하다.

---

## 2. User Stories

- As a user, I want to switch between a price chart view and an OHLCV data table view on the product detail page so that I can choose the format most useful to me.
- As a user, I want to see each day's open, high, low, close, and volume in a sortable table so that I can review the full price record for any given day.
- As a user, I want the price summary card to show the latest trading day's open, high, low, and volume alongside the existing close and 52-week stats so that I get a complete picture of recent price action at a glance.
- As a user, I want the OHLCV table to display the most recent dates first with pagination so that I can find recent data quickly without scrolling through hundreds of rows.

---

## 3. Scope

### In Scope

- Tab-based layout in `ProductDetailPage` — "가격 차트" tab and "가격 데이터" tab
- `PriceDataTab` component — OHLCV table with date, open, high, low, close, volume columns
- Client-side pagination for the OHLCV table (25 rows per page, most recent first)
- Enhanced `PriceSummaryCard` — add latest-day open, high, low, and volume stats
- New utility functions in `price-history-utils.ts` — `getLatestOpen`, `getLatestHigh`, `getLatestLow`, `getLatestVolume`
- Tab state preserved in URL search param (`?tab=chart` / `?tab=table`) via TanStack Router for shareable links
- Empty state and no-data handling for the OHLCV table (same product with no price data)
- Responsive column visibility: volume column hidden on small screens (`sm` breakpoint)

### Out of Scope

- ETF profile metadata (sector, fund manager, expense ratio, AUM) — requires new schema and external data source; deferred to a later PRD
- Distribution/dividend history — requires new schema; deferred
- Candlestick (OHLCV) chart — chart remains close-only line chart; OHLCV visualization deferred
- Volume bar chart panel in the chart tab
- Column-level sorting in the OHLCV table (click-to-sort headers) — fixed date-descending order only in Phase 1
- CSV/Excel export of price data
- Server-side pagination for price data — client already fetches full range data; pagination is client-side only
- Comparison with benchmark index

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Tab navigation | Given the user is on `/products/:id`, when the page loads, then two tabs are visible: "가격 차트" and "가격 데이터". The active tab is highlighted. Default active tab is "가격 차트". When `?tab=` is absent from the URL, the chart tab is active and the URL is not automatically rewritten. Tab state is reflected in the URL search param `?tab=chart` (default) or `?tab=table`. Clicking a tab updates the URL param and shows the corresponding content without a full page reload. |
| 2 | Price chart tab (unchanged) | Given the "가격 차트" tab is active, when the tab content renders, then the existing `PriceSummaryCard` (enhanced, see Story 4) and `PriceHistoryChart` with range selector are displayed — identical behavior to the current implementation. |
| 3 | OHLCV table tab | Given the "가격 데이터" tab is active, when price history rows exist, then the OHLCV table renders with columns: 날짜, 시가, 고가, 저가, 종가, 거래량. Rows are sorted by date descending (latest first). Numeric values are formatted with `ko-KR` locale. Volume is formatted with thousands separators and displayed as a whole number. Null values (open, high, low, volume) are displayed as `—` (em dash). |
| 4 | Enhanced price summary | Given any tab is active and price history data is loaded, when the `PriceSummaryCard` renders, then in addition to the existing stats (최근 종가, 52주 최고, 52주 최저, 데이터 기간), four new stats are shown in a second row: 시가 (latest open), 고가 (latest high), 저가 (latest low), 거래량 (latest volume). If a stat value is null, display `—`. |
| 5 | Pagination in OHLCV table | Given more than 25 rows exist for the selected range, when the OHLCV table tab is active, then pagination controls are shown below the table with "이전" and "다음" buttons and a "페이지 N / M" indicator. Clicking "다음" advances to the next page; "이전" goes back. "이전" is disabled on the first page; "다음" is disabled on the last page. Each page shows up to 25 rows. When the selected range changes, the current page resets to 1. |
| 6 | Empty state in OHLCV table | Given the product has no price history rows for the selected range, when the "가격 데이터" tab is active, then the table area shows EmptyState with message '수집된 가격 데이터가 없습니다.' consistent with the chart empty state. |
| 7 | Responsive volume column | Given the viewport is narrower than the `sm` breakpoint (640px), when the OHLCV table renders, then the 거래량 column is hidden. On `sm` and wider viewports, the 거래량 column is visible. |

---

## 5. Technical Design

### Architecture

```
Client (React + TanStack Router/Query)
──────────────────────────────────────
/products/:id
  ProductDetailPage
    ├─ [tab state from URL: ?tab=chart|table]
    ├─ ProductDetailHeader            (unchanged)
    ├─ PriceSummaryCard               (enhanced: + open/high/low/volume)
    └─ TabsLayout
         ├─ Tab: "가격 차트"
         │    └─ PriceHistoryChart   (unchanged)
         └─ Tab: "가격 데이터"
              └─ PriceDataTab        (new)
                   ├─ OhlcvTable     (new)
                   └─ PaginationControls (new or shared)
```

No new API endpoints are required. The existing `GET /api/products/:id/price-history?from=&to=` returns all OHLCV fields (`open`, `high`, `low`, `close`, `volume`) and is already consumed by `useProductDetail`. The same fetched data is reused for both the chart tab and the table tab.

### Tab State in URL

TanStack Router's `useSearch` / `useNavigate` with search param `tab`:

```typescript
// Tab type
type TabKey = 'chart' | 'table'

// Default: 'chart'
// URL: /products/42?tab=chart  or  /products/42?tab=table
```

The route definition is updated to declare the `tab` search param with `validateSearch` so TanStack Router types it correctly. On invalid `tab` values, fall back to `'chart'`.

### New Utility Functions (price-history-utils.ts)

```typescript
// Returns the open price of the most recent date row, or null if absent/null
export function getLatestOpen(rows: readonly PriceHistory[]): string | null

// Returns the high price of the most recent date row, or null if absent/null
export function getLatestHigh(rows: readonly PriceHistory[]): string | null

// Returns the low price of the most recent date row, or null if absent/null
export function getLatestLow(rows: readonly PriceHistory[]): string | null

// Returns the volume of the most recent date row, or null if absent/null
export function getLatestVolume(rows: readonly PriceHistory[]): number | null
```

Callers pass `summaryHistory` (1Y data) to these functions, consistent with `getLatestClose` — this ensures the "latest" values are always from the most recent date in the full 1Y window, regardless of the chart tab's selected range.

All four functions share the same "find the row with the latest date" logic as `getLatestClose`. They can be unified internally via a `getLatestRow` helper:

```typescript
function getLatestRow(rows: readonly PriceHistory[]): PriceHistory | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}
```

### Enhanced PriceSummaryCard

Current stats row (4 items, `grid-cols-2 sm:grid-cols-4`):
- 최근 종가, 52주 최고, 52주 최저, 데이터 기간

New second stats row (4 items, same grid):
- 시가 (latest open), 고가 (latest high), 저가 (latest low), 거래량 (latest volume)

Volume formatting: `volume.toLocaleString('ko-KR')` (no decimals). Null values → `—`.

`PriceSummaryCard` props interface is unchanged — it already receives `summaryHistory` (1Y data) which contains all OHLCV fields. No prop changes required.

### New Components

#### PriceDataTab (src/client/src/features/products/components/PriceDataTab.tsx)

```typescript
interface PriceDataTabProps {
  readonly priceHistory: readonly PriceHistory[]  // currently fetched range data
  readonly currency: string
}
```

Renders `OhlcvTable` with the rows sorted descending and pagination controls. Manages `currentPage` state internally (reset to 1 when `priceHistory` changes).

#### OhlcvTable (src/client/src/features/products/components/OhlcvTable.tsx)

```typescript
interface OhlcvTableProps {
  readonly rows: readonly PriceHistory[]   // pre-sliced page rows (25 items max)
  readonly currency: string
}
```

Renders a `<table>` with columns: 날짜, 시가, 고가, 저가, 종가, 거래량. Applies `hidden sm:table-cell` on the 거래량 `<th>` and `<td>` to hide on mobile. Formats prices with `ko-KR` locale and currency suffix. Formats dates as `YYYY.MM.DD`. Null values display as `—`.

#### Tab Layout

No new shared `Tabs` UI component is added in this PRD. The tab layout is implemented directly in `ProductDetailPage` with `Button` components (using `variant="ghost"` / `variant="primary"` pattern already established in `PriceHistoryChart` range buttons). The tab bar is a `div` with two `Button`s at the top of the content area below `PriceSummaryCard`. This avoids introducing a new UI primitive while keeping the implementation self-contained.

If a shared `Tabs` component is desired in the future, that is a separate UI library PRD.

### Route Update (TanStack Router)

The product detail route in `src/client/src/routes/assets.ts` is updated to add `validateSearch`:

```typescript
import { z } from 'zod/v4'

const tabSchema = z.object({
  tab: z.enum(['chart', 'table']).optional().default('chart'),
})

export const productDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$id',
  component: ProductDetailPage,
  validateSearch: tabSchema,
})
```

`ProductDetailPage` reads and sets the tab via `routeApi.useSearch()` and `useNavigate()` with `{ search: (prev) => ({ ...prev, tab }) }`.

### Frontend File Changes Summary

| File | Change |
|------|--------|
| `features/products/ProductDetailPage.tsx` | Add tab state from URL search param; render `PriceDataTab` in second tab |
| `features/products/price-history-utils.ts` | Add `getLatestOpen`, `getLatestHigh`, `getLatestLow`, `getLatestVolume`, `getLatestRow` |
| `features/products/components/PriceSummaryCard.tsx` | Add second stats row with open/high/low/volume |
| `features/products/components/PriceDataTab.tsx` | New: pagination + OhlcvTable wrapper |
| `features/products/components/OhlcvTable.tsx` | New: OHLCV table with responsive volume column |
| `routes/assets.ts` | Add `validateSearch` to `productDetailRoute` |
| `features/products/__tests__/price-history-utils.test.ts` | Add tests for 4 new utility functions |
| `features/products/__tests__/OhlcvTable.test.tsx` | New: table rendering tests |
| `features/products/__tests__/PriceDataTab.test.tsx` | New: pagination tests |

No server-side changes. No shared types changes. No new npm dependencies.

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | `price-history-utils.ts`: add `getLatestRow`, `getLatestOpen`, `getLatestHigh`, `getLatestLow`, `getLatestVolume`. Write unit tests (RED → GREEN) for all 4 functions including null handling. | Low |
| 2 | `PriceSummaryCard.tsx`: add second stats row. Update `PriceSummaryCard` tests to assert the 4 new stats render correctly with valid data and `—` for nulls. | Low |
| 3 | `OhlcvTable.tsx` (new): table component with ko-KR formatting, null `—` display, responsive volume column. Write rendering tests (non-null data, null open/high/low/volume, empty rows). | Low |
| 4 | `PriceDataTab.tsx` (new): pagination logic (slice, page counter, prev/next buttons). Write pagination tests: first page, last page button disabled states, page advance. | Medium |
| 5 | `routes/assets.ts`: add `validateSearch` with Zod schema. `ProductDetailPage.tsx`: read `tab` from `useSearch()`, render tab bar with `Button` components, conditionally render `PriceHistoryChart` or `PriceDataTab`. | Low |
| 6 | Integration: verify tab URL param round-trips (chart → table → chart, refresh preserves tab), empty state, and no regression on the chart tab. Manual smoke test. | Low |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] "가격 차트" and "가격 데이터" tabs visible on `/products/:id`; default active tab is "가격 차트"
- [ ] Tab state reflected in URL: `?tab=chart` and `?tab=table`; browser refresh preserves active tab
- [ ] Switching tabs does not trigger a new API fetch (data is reused from existing queries)
- [ ] "가격 차트" tab renders `PriceHistoryChart` with range selector — identical to current behavior; no regression
- [ ] "가격 데이터" tab renders OHLCV table with columns: 날짜, 시가, 고가, 저가, 종가, 거래량
- [ ] OHLCV table rows are sorted by date descending (latest date at top)
- [ ] Null open/high/low/volume values display as `—` (not null, undefined, or 0)
- [ ] Volume column is hidden on viewport < 640px and visible on >= 640px
- [ ] Pagination: 25 rows per page; "이전" disabled on page 1; "다음" disabled on last page; "페이지 N / M" indicator displayed
- [ ] `PriceSummaryCard` shows 8 stats total: 최근 종가, 52주 최고, 52주 최저, 데이터 기간, 시가, 고가, 저가, 거래량
- [ ] `PriceSummaryCard` displays `—` for null open/high/low/volume on the latest row
- [ ] Empty state '수집된 가격 데이터가 없습니다.' appears in the table tab when no price rows exist
- [ ] Tests achieve 80%+ coverage for new utility functions, `OhlcvTable`, and `PriceDataTab`
- [ ] `npx tsc --noEmit` passes with no new type errors
- [ ] No regression in existing product list navigation, chart range switching, or product-not-found behavior

---

## 8. Dependencies

- PRD-FEAT-007 (ETF Detail Page) — must be fully implemented; this PRD enhances the existing `ProductDetailPage`, `PriceSummaryCard`, and `PriceHistoryChart` components
- PRD-FEAT-005 (Price History Scheduler) — `price_history` table must contain OHLCV data (`open`, `high`, `low`, `volume` columns); `GET /api/products/:id/price-history` already returns all OHLCV fields
- TanStack Router `validateSearch` — used for URL tab state; already in `package.json`
- Zod — used in `validateSearch` schema; already in `package.json`
- Recharts — already in use for `PriceHistoryChart`; no new chart library needed
- Existing UI components: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `EmptyState` — all available in `src/client/src/components/ui/`

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing `PriceSummaryCard` layout breaks with 8 stats | Low | Second row uses the same `grid-cols-2 sm:grid-cols-4` pattern; visual regression tested manually before merge |
| `validateSearch` addition to `productDetailRoute` may break existing navigation calls that do not pass `tab` | Low | `tab` is `optional().default('chart')` in the Zod schema; existing `useNavigate({ to: '/products/$id' })` calls omit it and receive the default safely |
| Large OHLCV table (e.g., 365+ rows for 1Y range) causes slow initial render | Low | Client-side pagination slices to 25 rows; only the current page is rendered in DOM |
| `open`, `high`, `low` fields are null for products collected before OHLCV fields were stored | Medium | Null display logic (`—`) is mandatory per acceptance criteria; tested with null fixture data in unit tests |
| Tab state in URL collides with other search params in future | Low | `validateSearch` uses object spread `{ ...prev, tab }` to preserve other params; Zod schema is additive |
| File count for `features/products/components/` grows (currently 3, adds 2 more → 5) | Low | Stays within the `components/` pattern threshold; no restructuring needed |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD; Phase 1 scope: tab layout, OHLCV table, enhanced price summary. ETF profile and distribution history deferred. |
