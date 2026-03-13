---
type: prd
prd-id: PRD-FEAT-013
prd-type: feature
title: ETF Component UI (ETF 구성종목 UI)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: -
tags: [prd, etf, components, holdings, scheduler, ui]
---

# Feature: ETF Component UI (ETF 구성종목 UI)

## 1. Overview

PRD-FEAT-012에서 구현한 ETF 구성종목 수집 스케줄러가 백엔드에서 데이터를 수집하고 있으나, 사용자가 이 데이터를 확인할 수 있는 UI가 없다. 또한 ETF 구성종목 수집 스케줄러의 실행/중지/이력 확인을 위한 메뉴도 네비게이션에 추가되지 않았다.

이 PRD는 두 가지 UI 기능을 추가한다:

1. **상품 상세 페이지 구성종목 탭**: `/products/:id` 페이지의 기존 탭 시스템(차트/가격 데이터)에 '구성종목' 탭을 추가하여 ETF 구성종목(Holdings) 데이터를 스냅샷 날짜별로 조회할 수 있도록 한다.

2. **ETF 구성종목 스케줄러 메뉴**: 네비게이션 사이드바의 '스케줄러' 그룹에 'ETF 구성종목' 메뉴를 추가하고, 기존 가격수집 스케줄러 페이지 패턴을 재사용하여 수동 실행/중지/이력 조회 UI를 제공한다.

백엔드 API는 PRD-FEAT-012에서 모두 구현 완료되었으므로 프론트엔드 작업만 필요하다.

---

## 2. User Stories

- As a user, I want to view ETF component holdings on the product detail page so that I can see what stocks the ETF holds.
- As a user, I want to select different snapshot dates to compare holdings over time.
- As a user, I want to manually trigger or stop ETF component collection from the UI so that I can control the scheduler.
- As a user, I want to view ETF component collection execution history so that I can monitor scheduler health.

---

## 3. Scope

### In Scope

- 상품 상세 페이지에 '구성종목' 탭 추가 (기존 `chart` | `table` 탭에 `holdings` 추가)
- 스냅샷 날짜 선택 드롭다운 (최신 날짜 기본 선택)
- 구성종목 테이블: 종목코드, 종목명, 비중(%), 보유수량
- ETF가 아닌 종목에서는 구성종목 탭 미표시
- 네비게이션에 '스케줄러' 그룹 하위 'ETF 구성종목' 메뉴 추가
- ETF 구성종목 스케줄러 페이지: 수동 실행/중지 버튼 + 실행 이력 테이블
- `api.ts`에 ETF 구성종목 API 클라이언트 메서드 추가

### Out of Scope

- 구성종목 변화 추적 (snapshot 간 diff 비교)
- 비중 트렌드 차트
- 크로스-ETF 중복 분석
- 구성종목 검색/필터링

---

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | View holdings tab | Given a product with `etf_profiles` data, when the user navigates to `/products/:id?tab=holdings`, then a table of ETF components is displayed with columns: 종목코드, 종목명, 비중(%), 보유수량. |
| 2 | Select snapshot date | Given multiple snapshot dates exist, when the user opens the date dropdown, then all available dates are listed (DESC). Selecting a date refreshes the table. Default: most recent date. |
| 3 | No holdings data | Given a product has no ETF components, when the holdings tab is selected, then an empty state message '구성종목 데이터가 없습니다.' is shown. |
| 4 | Non-ETF product hides tab | Given a product with no `etf_profiles` entry, when the detail page loads, the '구성종목' tab is not shown. Tab schema validates `chart | table` only for non-ETF products. |
| 5 | Navigate to ETF scheduler | Given the user clicks '스케줄러 > ETF 구성종목' in the sidebar, then the browser navigates to `/scheduler/etf-components`. |
| 6 | Trigger ETF collection | Given the scheduler is idle, when the user clicks '수동 실행', then `POST /api/scheduler/etf-components/run` is called and the button shows a loading state. |
| 7 | Stop ETF collection | Given the scheduler is running, when the user clicks '중지', then `POST /api/scheduler/etf-components/stop` is called. |
| 8 | View ETF scheduler history | Given execution history exists, when the scheduler page loads, then the last 10 executions are shown with status, time, success/total counts. |

---

## 5. Technical Design

### Architecture

```
Client (React)                                  Server (Hono) — already exists
───────────────────────────                     ─────────────────────────────
/products/:id?tab=holdings
  ProductDetailPage
    └─ EtfHoldingsTab                  ──────► GET /api/etf-components/dates?productId=X
        ├─ date selector               ──────► GET /api/etf-components?productId=X&snapshotDate=Y
        └─ holdings table

/scheduler/etf-components
  EtfSchedulerPage
    ├─ run/stop buttons                ──────► POST /api/scheduler/etf-components/run
    │                                  ──────► POST /api/scheduler/etf-components/stop
    └─ execution history table         ──────► GET /api/scheduler/etf-components/status
```

### API Client Additions (api.ts)

```typescript
etfComponents: {
  getDates: (productId: number) =>
    request<string[]>(`/etf-components/dates?productId=${productId}`),
  getByDate: (productId: number, snapshotDate: string) =>
    request<EtfComponent[]>(`/etf-components?productId=${productId}&snapshotDate=${snapshotDate}`),
},
etfScheduler: {
  status: () => request<TaskExecution[]>('/scheduler/etf-components/status'),
  run: () => fetch(`${BASE_URL}/scheduler/etf-components/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  }).then(/* same pattern as price scheduler */),
  stop: () => request<null>('/scheduler/etf-components/stop', { method: 'POST' }),
},
```

### New Files

```
src/client/src/features/products/components/
  EtfHoldingsTab.tsx          # Holdings table + date selector

src/client/src/features/products/
  use-etf-holdings.ts         # useEtfHoldings(productId) hook

src/client/src/features/scheduler/
  EtfSchedulerPage.tsx        # ETF scheduler page (reuse SchedulerPage pattern)
  use-etf-scheduler.ts        # useEtfScheduler() hook
```

### Modified Files

```
src/client/src/lib/api.ts                    # Add etfComponents + etfScheduler namespaces
src/client/src/navigation.ts                 # Add ETF 구성종목 menu item
src/client/src/routes/assets.ts              # Expand tab schema: chart | table | holdings
src/client/src/routes/system.ts              # Add ETF scheduler route
src/client/src/features/products/
  ProductDetailPage.tsx                      # Add holdings tab option + EtfHoldingsTab
  use-product-detail.ts                      # Add hasEtfProfile query
```

### Tab Schema Change

```typescript
// routes/assets.ts — expand search schema
const productDetailSearchSchema = z.object({
  tab: z.enum(['chart', 'table', 'holdings']).optional().default('chart'),
})
```

### ETF Profile Detection

To conditionally show the holdings tab, the hook needs to check if the product has an ETF profile. Use the existing `/api/etf-components/dates` endpoint: if it returns dates, the product is an ETF with component data. If empty, still show the tab (for ETFs without collected data yet). For non-ETF products, the tab is hidden.

Approach: Fetch `/api/etf-components/dates?productId=X`. If the endpoint returns successfully (even empty array), show the tab. The product's `asset_type` field can also be used as a quick check — show tab only when `asset_type` includes 'ETF' or similar.

---

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | `api.ts`: Add `etfComponents` and `etfScheduler` API client methods | Low |
| 2 | `use-etf-holdings.ts`: Custom hook for date list + component data | Low |
| 3 | `EtfHoldingsTab.tsx`: Table component with date selector dropdown | Medium |
| 4 | `ProductDetailPage.tsx` + `use-product-detail.ts`: Add holdings tab conditionally, expand tab schema | Medium |
| 5 | `use-etf-scheduler.ts`: Custom hook (clone `use-scheduler.ts` for ETF endpoints) | Low |
| 6 | `EtfSchedulerPage.tsx`: Scheduler page (reuse SchedulerPage pattern) | Low |
| 7 | `navigation.ts` + `routes/system.ts`: Add menu item + route | Low |

---

## 7. Success Metrics

- [ ] 상품 상세 페이지에서 ETF 종목의 '구성종목' 탭이 표시됨
- [ ] 스냅샷 날짜 드롭다운이 최신 날짜를 기본 선택함
- [ ] 구성종목 테이블에 종목코드, 종목명, 비중(%), 보유수량이 표시됨
- [ ] 비 ETF 종목에서는 구성종목 탭이 표시되지 않음
- [ ] 구성종목 데이터 없을 때 빈 상태 메시지 표시됨
- [ ] 네비게이션 '스케줄러' 그룹에 'ETF 구성종목' 메뉴가 표시됨
- [ ] `/scheduler/etf-components` 페이지에서 수동 실행/중지 가능
- [ ] 스케줄러 실행 이력이 테이블로 표시됨
- [ ] TypeScript 컴파일 오류 없음
- [ ] 테스트 커버리지 80% 이상

---

## 8. Dependencies

- PRD-FEAT-012 (ETF Component Collection Scheduler) — backend APIs: `GET /api/etf-components`, `GET /api/etf-components/dates`, `POST /api/scheduler/etf-components/run`, `POST /api/scheduler/etf-components/stop`, `GET /api/scheduler/etf-components/status`
- PRD-FEAT-007 + PRD-FEAT-011 (ETF Detail Page) — existing product detail page with tab system
- TanStack Query — `useQuery`/`useMutation` for data fetching and caching
- Shared types: `EtfComponent`, `TaskExecution` from `@shared/types`

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ETF profile seeds are empty (Wave 8 not done) | Medium | Holdings tab shows empty state gracefully; scheduler can still run (0 profiles = instant success) |
| Tab schema change may break existing bookmarks with `?tab=chart` | Low | Schema default is `chart`; existing URLs continue to work |
| Non-ETF products hitting dates endpoint returns empty array | Low | Use `asset_type` check or dates length to conditionally show tab |

---

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | - | Initial PRD for ETF Component UI (holdings tab + scheduler menu) |
