import { createRouter } from '@tanstack/react-router'
import { rootRoute, indexRoute } from './root'
import { dashboardRoute } from './dashboard'
import { assetRoutes } from './assets'
import { analysisRoutes } from './analysis'
import { planningRoutes } from './planning'
import { taxRoutes } from './tax'
import { settingsRoutes } from './settings'
import { systemRoutes } from './system'

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  ...assetRoutes,
  ...analysisRoutes,
  ...planningRoutes,
  ...taxRoutes,
  ...settingsRoutes,
  ...systemRoutes,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
