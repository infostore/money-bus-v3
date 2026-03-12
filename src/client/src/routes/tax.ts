import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { ComingSoon } from './shared'

export const taxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax',
  component: ComingSoon,
})

export const taxRoutes = [taxRoute] as const
