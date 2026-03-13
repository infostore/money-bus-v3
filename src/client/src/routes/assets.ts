import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { z } from 'zod/v4'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

const productDetailSearchSchema = z.object({
  tab: z.enum(['chart', 'table']).optional().default('chart'),
})

const ProductPage = lazy(() =>
  import('../features/settings/ProductPage').then((m) => ({
    default: m.ProductPage,
  })),
)

const ProductDetailPage = lazy(() =>
  import('../features/products/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
)

// PRD-FEAT-010: Account Management
const AccountPage = lazy(() =>
  import('../features/settings/AccountPage').then((m) => ({
    default: m.AccountPage,
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
  component: AccountPage,
})

export const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ProductPage,
})

// PRD-FEAT-007 + PRD-FEAT-011: ETF Detail Page with tabs
export const productDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$id',
  component: ProductDetailPage,
  validateSearch: productDetailSearchSchema,
})

export const assetRoutes = [
  portfolioRoute,
  accountsRoute,
  productsRoute,
  productDetailRoute,
] as const
