import { createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '../components/layout/AppLayout'

export const rootRoute = createRootRoute({
  component: AppLayout,
})

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
