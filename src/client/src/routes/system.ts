import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

const SchedulerPage = lazy(() =>
  import('../features/scheduler/SchedulerPage').then((m) => ({
    default: m.SchedulerPage,
  })),
)

// PRD-FEAT-013: ETF Component UI
const EtfSchedulerPage = lazy(() =>
  import('../features/scheduler/EtfSchedulerPage').then((m) => ({
    default: m.EtfSchedulerPage,
  })),
)

// PRD-FEAT-016: Exchange Rate Collection Scheduler
const ExchangeRateSchedulerPage = lazy(() =>
  import('../features/scheduler/ExchangeRateSchedulerPage').then((m) => ({
    default: m.ExchangeRateSchedulerPage,
  })),
)

// PRD-FEAT-017: Holdings Price Collection Scheduler
const HoldingsPriceSchedulerPage = lazy(() =>
  import('../features/scheduler/HoldingsPriceSchedulerPage').then((m) => ({
    default: m.HoldingsPriceSchedulerPage,
  })),
)

export const priceCollectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scheduler/price-collection',
  component: SchedulerPage,
})

// PRD-FEAT-013: ETF Component UI
export const etfComponentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scheduler/etf-components',
  component: EtfSchedulerPage,
})

// PRD-FEAT-016: Exchange Rate Collection Scheduler
export const exchangeRateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scheduler/exchange-rate',
  component: ExchangeRateSchedulerPage,
})

// PRD-FEAT-017: Holdings Price Collection Scheduler
export const holdingsPriceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scheduler/holdings-price',
  component: HoldingsPriceSchedulerPage,
})

export const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: ComingSoon,
})

export const systemRoutes = [
  priceCollectionRoute,
  etfComponentsRoute,
  exchangeRateRoute,
  holdingsPriceRoute,
  helpRoute,
] as const
