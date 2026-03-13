import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

const SchedulerPage = lazy(() =>
  import('../features/scheduler/SchedulerPage').then((m) => ({
    default: m.SchedulerPage,
  })),
)

export const schedulerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scheduler',
  component: SchedulerPage,
})

export const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: ComingSoon,
})

export const systemRoutes = [schedulerRoute, helpRoute] as const
