import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

export const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: ComingSoon,
})

export const systemRoutes = [helpRoute] as const
