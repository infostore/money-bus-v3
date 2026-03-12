import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

export const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analysis',
  component: ComingSoon,
})

export const analysisRoutes = [analysisRoute] as const
