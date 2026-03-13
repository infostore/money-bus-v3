---
type: prd
prd-id: PRD-FEAT-007
prd-type: feature
title: ETF Detail Page (ETF 상세 페이지)
status: approved
implementation-status: completed
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, etf, product, detail, price-history, chart]
---

# Feature: ETF Detail Page (ETF 상세 페이지)

## 1. Overview

종목 관리(PRD-FEAT-004) 화면에서 사용자는 ETF 종목 목록을 볼 수 있지만, 개별 ETF 종목의 상세 정보(기본 메타데이터 + 가격 이력 차트)를 한눈에 확인할 방법이 없다. 특히 PRD-FEAT-005(가격 수집 스케줄러)를 통해 `price_history` 테이블에 OHLCV 데이터가 누적되기 시작했으므로, 이 데이터를 사용자에게 가시화하는 진입점이 필요하다.

ETF 상세 페이지는 종목 목록(`/products`)에서 특정 ETF 행을 클릭했을 때 이동하는 `/products/:id` 경로의 독립 페이지이다. 페이지는 세 가지 정보 영역으로 구성된다. (1) 상단 헤더 영역: 종목 이름·코드·거래소·통화·자산유형 등 기본 메타 정보, (2) 가격 요약 카드: 최근 종가, 52주 최고/최저가, 수집된 가격 데이터 기간, (3) 가격 이력 차트: 선택 가능한 기간(1M / 3M / 6M / 1Y / 전체)별 종가 추이 라인 차트.

이 기능은 ETF 자산유형에 국한된 상세 페이지를 먼저 구현하고, 향후 주식·펀드 등 다른 자산유형으로 확장하는 기반을 마련한다. 서버에는 새로운 API 엔드포인트 `GET /api/products/:id/price-history`를 추가하여 날짜 범위 필터를 지원하고, 클라이언트는 TanStack Query로 상세 데이터를 캐싱한다.

---

## 2. User Stories

- As a user, I want to click on an ETF product in the product list so that I can view its detailed information on a dedicated page.
- As a user, I want to see the ETF's basic metadata (code, exchange, currency, asset type) at a glance so that I can confirm I am looking at the right instrument.
- As a user, I want to see a price summary card with the latest close price, 52-week high/low, and data coverage period so that I understand the ETF's performance at a glance.
- As a user, I want to view a historical close price chart so that I can see the ETF's price trend over time.
- As a user, I want to select the chart time range (1M / 3M / 6M / 1Y / 전체) so that I can zoom in or out on the price history.
- As a user, I want to navigate back to the product list from the detail page so that I can continue browsing other instruments.

---

## 3. Scope

### In Scope

- `/products/:id` route (TanStack Router) — ETF 상세 페이지
- `GET /api/products/:id` API endpoint — 단일 종목 메타데이터 조회
- `GET /api/products/:id/price-history` API endpoint — 날짜 범위 필터 지원 (`?from=YYYY-MM-DD&to=YYYY-MM-DD`)
- `ProductRepository.findById(id)` — 이미 존재하는 메서드 활용
- `PriceHistoryRepository.findByProductId(productId)` — 이미 존재하는 메서드 활용; 범위 필터는 클라이언트가 API 파라미터로 전달하고 서버가 처리
- `useProductDetail` custom hook — 단일 종목 + 가격 이력 패치
- `ProductDetailPage` — 라우트 타깃 페이지 컴포넌트
- `ProductDetailHeader` — 종목 기본 메타 정보 헤더 컴포넌트
- `PriceSummaryCard` — 최근 종가, 52주 최고/최저, 데이터 기간 표시 카드
- `PriceHistoryChart` — 라인 차트 (Recharts 사용), 기간 선택 버튼 포함
- `price-history-utils.ts` — 52주 고/저 계산, 기간 필터 유틸
- ETF 자산유형 종목에서 상세 페이지 진입 지원 (다른 자산유형도 같은 라우트를 사용하지만 초기 버전은 ETF 시나리오를 우선 검증)
- 가격 데이터 없음 상태(EmptyState) 처리
- 종목 미존재 시 404 처리 (클라이언트에서 오류 메시지 표시)
- `ProductTable`에 클릭 시 상세 페이지로 이동하는 인터랙션 추가

### Out of Scope

- 캔들스틱(OHLCV) 차트 — 라인 차트(종가만) 우선 구현; 향후 PRD에서 확장
- 거래량(Volume) 차트 별도 패널
- 종목 비교 기능 (두 종목 이상 동시 차트)
- 실시간 또는 당일 intraday 가격 표시
- ETF 구성 종목(Holdings) 목록 표시
- 배당 이력 표시
- 가격 알림(alert) 설정
- 암호화폐·예적금 자산유형 전용 UI (공통 상세 페이지 사용)
- 주식 상세 페이지 전용 기업 개요(Fundamental) 정보

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Navigate to ETF detail page | Given the user is on `/products`, when they click on any product row, then the browser navigates to `/products/:id`. The URL contains the product's numeric ID. Back button returns to `/products`. |
| 2 | View product metadata | Given a valid product ID, when `GET /api/products/:id` is called, then it returns `ApiResponse<Product>` (200) with all fields. If the ID does not exist, returns 404 with `{ success: false, data: null, error: 'Product not found' }`. On the client, the header section displays: name (large), code (badge), exchange (badge), currency (badge), asset_type (badge). |
| 3 | View price summary | Given price history rows exist for the product, when the page loads, then the summary card shows: (a) 최근 종가 — the `close` value of the most recent date row, (b) 52주 최고 — maximum `close` in the last 365 days, (c) 52주 최저 — minimum `close` in the last 365 days, (d) 데이터 기간 — earliest and latest date in the fetched range. If no price history exists, the summary card shows a placeholder "가격 데이터 없음" message. |
| 4 | View price history chart | Given price history rows exist, when the page loads with the default time range (1Y), then a line chart renders with date on the x-axis and close price on the y-axis. Data points are sorted ascending by date. The chart tooltip shows date and close price on hover. |
| 5 | Select chart time range | Given the chart is displayed, when the user clicks a range button (1M / 3M / 6M / 1Y / 전체), then the API is called with the corresponding `?from=` and `?to=` params (to = today, from = today minus the selected period). The chart updates to show only rows within the selected range. The active range button is visually highlighted. Default range on page load is 1Y. |
| 6 | Handle no price data | Given a product exists but has no rows in `price_history`, when the detail page loads, then the chart area shows EmptyState with message '수집된 가격 데이터가 없습니다.' and the summary card shows '가격 데이터 없음' placeholders. No chart rendering error occurs. |
| 7 | Handle invalid product ID | Given the user navigates to `/products/99999` (non-existent ID), when the page loads and the API returns 404, then the page displays an Alert with message '종목을 찾을 수 없습니다.' and a '목록으로 돌아가기' button that navigates to `/products`. |

---

## 5. Technical Design

### Architecture

```
Client (React + TanStack Router/Query)       Server (Hono)
──────────────────────────────────────       ─────────────────────────────────
/products                                    GET /api/products        (existing)
  ProductTable ──[click row]──────────►
/products/:id
  ProductDetailPage
    └─ useProductDetail(id)          ──────► GET /api/products/:id      (new)
         ├─ useQuery(productKey)     ──────► GET /api/products/:id/price-history (new)
         └─ useQuery(priceKey)
    ├─ ProductDetailHeader
    ├─ PriceSummaryCard
    │    └─ price-history-utils.ts
    └─ PriceHistoryChart (Recharts)
         └─ RangeSelector buttons
```

### New API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/products/:id` | Fetch single product by ID | `ApiResponse<Product>` (200) or 404 |
| GET | `/api/products/:id/price-history` | Fetch price history for product; optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `ApiResponse<PriceHistory[]>` (200) or 404 |

Note: `GET /api/products` (list) already exists. The new `GET /api/products/:id` is a detail endpoint added to the existing products route file.

Note on price-history endpoint: if `from`/`to` params are provided, the server filters rows by `date >= from AND date <= to`. If omitted, all rows for the product are returned. The server validates date format (YYYY-MM-DD) and returns 400 on invalid format.

### Repository Changes

`ProductRepository` already has `findById(id: number)` — no changes needed.

`PriceHistoryRepository` needs a new method with optional date range filtering:

```typescript
// New method on PriceHistoryRepository
async findByProductIdInRange(
  productId: number,
  from?: string,  // YYYY-MM-DD
  to?: string,    // YYYY-MM-DD
): Promise<readonly PriceHistory[]>
```

This method replaces the use of `findByProductId` for the API endpoint; `findByProductId` continues to be used by the scheduler's internal logic.

### Shared TypeScript Types (src/shared/types.ts)

No new entity types needed — `Product` and `PriceHistory` are already defined. One query-response type is added for the price-history endpoint's optional metadata:

```typescript
// PRD-FEAT-007: ETF Detail Page
export interface PriceHistoryRangeQuery {
  readonly from?: string   // YYYY-MM-DD
  readonly to?: string     // YYYY-MM-DD
}
```

### Price History Utils (src/client/src/features/products/price-history-utils.ts)

```typescript
export function getLatestClose(rows: readonly PriceHistory[]): string | null
export function get52WeekHigh(rows: readonly PriceHistory[]): string | null
export function get52WeekLow(rows: readonly PriceHistory[]): string | null
export function getDateRange(rows: readonly PriceHistory[]): { from: string; to: string } | null

// Returns the ISO date string for 'from' given a range key
export function rangeToFromDate(range: RangeKey): string
export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL'
```

All calculations operate on `close` values (string → `parseFloat` for comparison). `get52WeekHigh/Low` always compute against 1Y of data fetched via a separate query, regardless of the chart's selected range. This ensures the 52-week stats are always accurate.

### Frontend Components

```
src/client/src/features/products/
  ProductDetailPage.tsx         # Route target (/products/:id)
  use-product-detail.ts         # useProductDetail(id) hook
  price-history-utils.ts        # Pure utility functions
  components/
    ProductDetailHeader.tsx     # Name, code, exchange, currency, asset_type badges
    PriceSummaryCard.tsx        # Latest close, 52W high/low, date range
    PriceHistoryChart.tsx       # Recharts LineChart + RangeSelector
```

Note: Existing product-list components remain under `features/settings/`. The new detail page lives under `features/products/` as a separate domain feature.

### Routing

```typescript
// src/client/src/routes/assets.ts (addition)
const ProductDetailPage = lazy(() =>
  import('../features/products/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
)

export const productDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$id',
  component: ProductDetailPage,
})

// Add productDetailRoute to assetRoutes array
```

The `:id` param is typed as string in TanStack Router (`$id`); parse with `parseInt(params.id, 10)` inside the component.

### Client Hook

```typescript
// src/client/src/features/products/use-product-detail.ts
const PRODUCT_KEY = (id: number) => ['product', id] as const
const PRICE_HISTORY_KEY = (id: number, range: RangeKey) =>
  ['price-history', id, range] as const

export function useProductDetail(id: number, range: RangeKey) {
  const productQuery = useQuery({
    queryKey: PRODUCT_KEY(id),
    queryFn: () => api.products.getById(id),
    enabled: id > 0,
  })

  // Chart data — filtered by selected range
  const priceHistoryQuery = useQuery({
    queryKey: PRICE_HISTORY_KEY(id, range),
    queryFn: () => api.products.getPriceHistory(id, rangeToFromDate(range)),
    enabled: id > 0,
  })

  // Summary stats — always 1Y for accurate 52W high/low
  const summaryQuery = useQuery({
    queryKey: PRICE_HISTORY_KEY(id, '1Y'),
    queryFn: () => api.products.getPriceHistory(id, rangeToFromDate('1Y')),
    enabled: id > 0,
  })

  return {
    product: productQuery.data ?? null,
    priceHistory: priceHistoryQuery.data ?? [],
    summaryHistory: summaryQuery.data ?? [],
    loading: productQuery.isLoading || priceHistoryQuery.isLoading,
    productError: productQuery.error instanceof Error ? productQuery.error.message : null,
    priceError: priceHistoryQuery.error instanceof Error ? priceHistoryQuery.error.message : null,
  } as const
}
```

### Recharts Integration

`PriceHistoryChart` uses `LineChart` from `recharts`:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Data shape fed to Recharts
interface ChartDataPoint {
  readonly date: string    // YYYY-MM-DD (x-axis)
  readonly close: number   // parseFloat(row.close) (y-axis)
}
```

- `ResponsiveContainer width="100%" height={320}`
- X-axis: `date`, tick format `MM/DD` (locale-agnostic)
- Y-axis: auto-domain with `tickFormatter` for currency display
- Tooltip: custom renderer showing date and formatted close price
- Line: `dot={false}`, `strokeWidth={2}`, primary brand color

Note: `recharts` is NOT currently in `package.json` (confirmed). Add `recharts` as a dependency in Wave 6 before implementing the chart component.

### ProductTable Update

`ProductTable.tsx` receives an optional `onDetail?: (product: Product) => void` prop. Each product row gains a `ChevronRight` icon button that calls `onDetail(product)`. The `ProductView.tsx` wires this to `useNavigate()` from TanStack Router.

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Server: add `GET /api/products/:id` to existing products route; add `PriceHistoryRepository.findByProductIdInRange()` with optional date range; add `GET /api/products/:id/price-history` route with `from`/`to` query param validation | Medium |
| 2 | Server tests (RED) + implementation (GREEN): `findByProductIdInRange` repository unit test; route integration tests for 200/404/400 on both new endpoints | Medium |
| 3 | Client: `price-history-utils.ts` — pure functions + unit tests (RangeKey → date, 52W calc, latest close) | Low |
| 4 | Client: `api.products.getById()` + `api.products.getPriceHistory()` methods in `src/client/src/lib/api.ts`; `useProductDetail` hook + hook tests | Low |
| 5 | Client: `ProductDetailPage`, `ProductDetailHeader`, `PriceSummaryCard` — skeleton + loading/error/empty states | Medium |
| 6 | Client: `PriceHistoryChart` with Recharts LineChart + RangeSelector buttons + chart time range switching | Medium |
| 7 | Routing: add `productDetailRoute` to `assets.ts`; update `ProductTable` with `onDetail` prop; wire navigation in `ProductView` | Low |

Note: Follows mandatory TDD workflow — tests are written before implementation within each wave (RED → GREEN → REFACTOR).

---

## 7. Success Metrics

- [ ] Clicking a product row in `/products` navigates to `/products/:id`
- [ ] `GET /api/products/:id` returns 200 with correct product data
- [ ] `GET /api/products/:id` returns 404 with error message for non-existent ID
- [ ] `GET /api/products/:id/price-history` returns 200 with all rows when no params
- [ ] `GET /api/products/:id/price-history?from=2025-01-01&to=2025-12-31` returns only rows within range
- [ ] `GET /api/products/:id/price-history?from=invalid` returns 400
- [ ] Product detail header displays name, code, exchange, currency, and asset_type badges
- [ ] Price summary card shows latest close, 52-week high, 52-week low, and data coverage period
- [ ] Price history line chart renders with date on x-axis and close price on y-axis
- [ ] Chart time range selector (1M / 3M / 6M / 1Y / 전체) is functional; active range is visually highlighted
- [ ] Switching range triggers a new query with updated `from` param; chart updates accordingly
- [ ] Default chart range on page load is 1Y
- [ ] No price data: chart area shows EmptyState '수집된 가격 데이터가 없습니다.' without JS errors
- [ ] Non-existent product ID: page shows Alert '종목을 찾을 수 없습니다.' and back-to-list button
- [ ] Back navigation from detail page returns user to `/products`
- [ ] Tests achieve 80%+ coverage for new server routes, repository method, and client utilities

---

## 8. Dependencies

- PRD-FEAT-004 (Product Management) — `products` table and `ProductRepository.findById()` are the data source for product metadata
- PRD-FEAT-005 (Price History Scheduler) — `price_history` table and `PriceHistoryRepository` are the data source for the chart; `findByProductId()` is the basis for the new ranged method
- `recharts` npm package — LineChart component for price history visualization (verify it is already in `package.json`)
- TanStack Router — `createRoute` with `$id` param; `useNavigate` for programmatic navigation from `ProductTable`
- TanStack Query — `useQuery` for product + price-history data with cache keying per `(id, range)`
- Existing shared UI components: `Card`, `CardContent`, `Button`, `Alert`, `EmptyState`, `Spinner`, `Badge` (if available) or `span` badge pattern

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `price_history` table may have no data for most products at time of implementation | Medium | Implement empty-state UI first (Story 6); chart renders gracefully with 0 rows |
| `recharts` not in `package.json` (confirmed) | Low | Add `recharts` as a runtime dependency in Wave 6 before implementing `PriceHistoryChart`; `recharts` bundles its own types so no separate `@types/recharts` needed |
| `close` field is stored as PostgreSQL `numeric` and returned as string by pg driver | Medium | `parseFloat(row.close)` in `price-history-utils.ts`; validate assumption in unit tests |
| Large price history payload (1,806 products × 365 rows = ~659K rows if user hits 전체 range) | Medium | Default range is 1Y; 전체 range is opt-in; add pagination as a follow-up if response size becomes a concern |
| TanStack Router `$id` param is string — parseInt may produce NaN | Low | Guard: if `isNaN(id)` redirect to `/products` or show 404 state immediately without API call |
| `ProductTable` onDetail prop change is a breaking change for existing tests | Low | `onDetail` is optional prop; existing tests without this prop remain valid |
| Feature scope creep to other asset types | Low | PRD explicitly scopes to `/products/:id` shared route; ETF is the primary validation scenario; no asset-type-specific branching in v1 |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for ETF Detail Page; leverages existing price_history data from PRD-FEAT-005 |
