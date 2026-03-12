import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

const ProductPage = lazy(() =>
  import('../features/settings/ProductPage').then((m) => ({
    default: m.ProductPage,
  })),
)

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
  component: ProductPage,
})

export const assetRoutes = [
  portfolioRoute,
  accountsRoute,
  productsRoute,
] as const
