import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'

const DashboardPage = lazy(() =>
  import('../features/dashboard/Dashboard').then((m) => ({
    default: m.Dashboard,
  })),
)

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})
