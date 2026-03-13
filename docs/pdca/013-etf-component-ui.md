---
type: pdca-plan
plan-name: ETF Component UI
related-prd: PRD-FEAT-013
phase: do
status: in-progress
created: 2026-03-13
updated: 2026-03-13
tags: [pdca, etf, components, holdings, scheduler, ui, frontend]
---

# PDCA Plan: ETF Component UI

## Plan

- **Goal**: Add ETF component holdings tab to product detail page and ETF component scheduler page to navigation — frontend only, all backend APIs already exist from PRD-FEAT-012.

- **Scope**:
  - Wave 1: API client methods in `api.ts`
  - Wave 2: `use-etf-holdings.ts` custom hook
  - Wave 3: `EtfHoldingsTab.tsx` component
  - Wave 4: Product detail page integration (tab schema + conditional tab)
  - Wave 5: `use-etf-scheduler.ts` custom hook
  - Wave 6: `EtfSchedulerPage.tsx` page
  - Wave 7: Navigation menu + route registration

- **Success Metrics**:
  - [ ] ETF product detail page shows '구성종목' tab with holdings data
  - [ ] Snapshot date dropdown defaults to most recent date
  - [ ] Non-ETF products do not show holdings tab
  - [ ] Navigation shows 'ETF 구성종목' under scheduler group
  - [ ] ETF scheduler page supports run/stop/history viewing
  - [ ] TypeScript compiles cleanly
  - [ ] Tests achieve 80%+ coverage

## Do

- **Tasks**:

  ### Wave 1 — API Client
  - [ ] Add `etfComponents.getDates()` and `etfComponents.getByDate()` to `api.ts`
  - [ ] Add `etfScheduler.status()`, `etfScheduler.run()`, `etfScheduler.stop()` to `api.ts`

  ### Wave 2 — Holdings Hook
  - [ ] Create `use-etf-holdings.ts` with `useEtfHoldings(productId)` hook — manages date list, selected date, component data

  ### Wave 3 — Holdings Tab Component
  - [ ] Create `EtfHoldingsTab.tsx` — date selector dropdown + holdings table (종목코드, 종목명, 비중, 보유수량)
  - [ ] Handle empty state: '구성종목 데이터가 없습니다.'

  ### Wave 4 — Product Detail Integration
  - [ ] Expand tab schema in `routes/assets.ts` to include `'holdings'`
  - [ ] Update `ProductDetailPage.tsx` to render `EtfHoldingsTab` when `tab === 'holdings'`
  - [ ] Conditionally show holdings tab only for ETF products

  ### Wave 5 — ETF Scheduler Hook
  - [ ] Create `use-etf-scheduler.ts` — clone `use-scheduler.ts` pattern for ETF endpoints

  ### Wave 6 — ETF Scheduler Page
  - [ ] Create `EtfSchedulerPage.tsx` — reuse SchedulerPage pattern with ETF-specific labels

  ### Wave 7 — Navigation + Route
  - [ ] Add 'ETF 구성종목' nav item under scheduler group in `navigation.ts`
  - [ ] Add route in `routes/system.ts` for `/scheduler/etf-components`

- **Progress Log**:
  - 2026-03-13: PDCA plan created.

## Check

- **Results**:
  - (to be filled after implementation)

- **Evidence**:
  - (to be filled after implementation)

## Act

- **Learnings**:
  1. (to be filled after implementation)

- **Next Actions**:
  1. Wave 8 of PRD-FEAT-012: Populate real ETF profile seeds and verify end-to-end
  2. Component change tracking / delta detection between snapshots (future PRD)
