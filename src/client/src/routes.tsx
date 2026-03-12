import { lazy } from 'react'
import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/layout/AppLayout'

const rootRoute = createRootRoute({
  component: AppLayout,
})

// -- Implemented views --
const Dashboard = lazy(() =>
  import('./features/dashboard/Dashboard').then((m) => ({
    default: m.Dashboard,
  })),
)

const SettingsView = lazy(() =>
  import('./features/settings/SettingsView').then((m) => ({
    default: m.SettingsView,
  })),
)

// -- Placeholder for unimplemented views --
function ComingSoon() {
  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-surface-500 text-lg">준비 중입니다.</p>
    </div>
  )
}

// -- Route definitions --
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
})

const portfolioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/portfolio',
  component: ComingSoon,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  component: ComingSoon,
})

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ComingSoon,
})

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analysis',
  component: ComingSoon,
})

const planningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/planning',
  component: ComingSoon,
})

const taxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax',
  component: ComingSoon,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsView,
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: ComingSoon,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  portfolioRoute,
  accountsRoute,
  productsRoute,
  analysisRoute,
  planningRoute,
  taxRoute,
  settingsRoute,
  helpRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
