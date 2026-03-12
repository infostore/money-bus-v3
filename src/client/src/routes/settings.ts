import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'

const SettingsPage = lazy(() =>
  import('../features/settings/SettingsView').then((m) => ({
    default: m.SettingsView,
  })),
)

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

export const settingsRoutes = [settingsRoute] as const
