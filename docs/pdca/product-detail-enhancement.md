---
type: pdca-plan
plan-name: Product Detail Enhancement (종목 상세 페이지 고도화)
related-prd: PRD-FEAT-011
phase: plan
status: not-started
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, product, detail, ohlcv, tabs]
---

# PDCA Plan: Product Detail Enhancement (종목 상세 페이지 고도화)

## Plan

- **Goal**: Enhance the product detail page with a tab-based layout, OHLCV price data table, and enriched price summary card — using only existing `price_history` data (no schema or server changes).

- **Scope**:
  - Tab-based layout ("가격 차트" / "가격 데이터") with URL search param state
  - OHLCV table with date-descending sort, ko-KR formatting, null display (`—`), responsive volume column
  - Client-side pagination (25 rows/page) with prev/next controls
  - Enhanced `PriceSummaryCard` — second stats row with latest open/high/low/volume
  - New utility functions in `price-history-utils.ts`
  - Route update with `validateSearch` for tab param

- **Success Metrics**:
  - [ ] Two tabs visible on `/products/:id`; default is "가격 차트"
  - [ ] Tab state reflected in URL `?tab=chart` / `?tab=table`; refresh preserves tab
  - [ ] Tab switching does not trigger new API fetch
  - [ ] OHLCV table renders 날짜/시가/고가/저가/종가/거래량 columns, date descending
  - [ ] Null values display as `—`; volume hidden on < 640px
  - [ ] Pagination: 25 rows/page, disabled buttons on first/last page, resets on range change
  - [ ] `PriceSummaryCard` shows 8 stats (existing 4 + open/high/low/volume)
  - [ ] Empty state shown when no price data exists
  - [ ] 80%+ test coverage for new code
  - [ ] `npx tsc --noEmit` passes; no regression

## Do

- **Tasks**:
  - [ ] Wave 1: Add `getLatestRow`, `getLatestOpen`, `getLatestHigh`, `getLatestLow`, `getLatestVolume` to `price-history-utils.ts` + unit tests
  - [ ] Wave 2: Enhance `PriceSummaryCard` with second stats row (open/high/low/volume) + tests
  - [ ] Wave 3: Create `OhlcvTable` component with formatting, null display, responsive volume + tests
  - [ ] Wave 4: Create `PriceDataTab` component with pagination logic + tests
  - [ ] Wave 5: Update route (`validateSearch`), add tab layout to `ProductDetailPage`
  - [ ] Wave 6: Integration verification — tab URL round-trip, empty state, no chart regression

- **Progress Log**:
  - 2026-03-13: PDCA plan created

## Check

- **Results**:
  - [Pending]

- **Evidence**:
  - [Pending]

## Act

- **Learnings**:
  1. [Pending]

- **Next Actions**:
  1. [Pending]
