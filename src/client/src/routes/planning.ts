import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

export const planningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/planning',
  component: ComingSoon,
})

export const planningRoutes = [planningRoute] as const
