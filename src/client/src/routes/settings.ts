import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'

const SettingsPage = lazy(() =>
  import('../features/settings/SettingsView').then((m) => ({
    default: m.SettingsView,
  })),
)

const FamilyMemberPage = lazy(() =>
  import('../features/settings/FamilyMemberPage').then((m) => ({
    default: m.FamilyMemberPage,
  })),
)

const InstitutionPage = lazy(() =>
  import('../features/settings/InstitutionPage').then((m) => ({
    default: m.InstitutionPage,
  })),
)

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

export const familyMembersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/family-members',
  component: FamilyMemberPage,
})

export const institutionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/institutions',
  component: InstitutionPage,
})

export const settingsRoutes = [settingsRoute, familyMembersRoute, institutionsRoute] as const
