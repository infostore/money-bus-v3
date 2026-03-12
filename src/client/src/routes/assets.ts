import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

export const portfolioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/portfolio',
  component: ComingSoon,
})

export const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  component: ComingSoon,
})

export const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ComingSoon,
})

export const assetRoutes = [
  portfolioRoute,
  accountsRoute,
  productsRoute,
] as const
