# Routing & Server State Patterns

## TanStack Router — Code-Based Routes

### Directory Structure

```
src/client/src/
  navigation.ts           # NAV_GROUPS data + findGroupForPath (single source of truth)
  routes/
    index.ts              # Assembles all domain routes → createRouter
    root.ts               # rootRoute (AppLayout) + index redirect
    shared.tsx            # Shared route components (ComingSoon placeholder)
    dashboard.ts          # Domain: overview
    assets.ts             # Domain: portfolio, accounts, products
    analysis.ts           # Domain: analysis
    planning.ts           # Domain: planning
    tax.ts                # Domain: tax
    settings.ts           # Domain: settings
    system.ts             # Domain: help
```

### Adding a New Route

1. Add route to the appropriate domain file (or create new domain file):

```typescript
// routes/assets.ts
import { lazy } from 'react'
import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'

const AccountDetailPage = lazy(() =>
  import('../features/accounts/AccountDetailPage').then((m) => ({
    default: m.AccountDetailPage,
  })),
)

// Nested route with URL parameter
export const accountDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts/$accountId',
  component: AccountDetailPage,
})

export const assetRoutes = [
  portfolioRoute,
  accountsRoute,
  accountDetailRoute,  // Add to exported array
  productsRoute,
] as const
```

2. If new domain file, import in `routes/index.ts`:

```typescript
import { newDomainRoutes } from './new-domain'

const routeTree = rootRoute.addChildren([
  ...existingRoutes,
  ...newDomainRoutes,
])
```

3. Add nav item to `navigation.ts` if it appears in sidebar.

### Route Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| Static | `/dashboard` | Top-level pages |
| Param | `/accounts/$accountId` | Detail views |
| Nested | `/tax/income`, `/tax/deductions` | Section sub-pages |
| Layout route | `id: 'assets'` (no path) | Shared section layout with `<Outlet>` |

### Lazy Loading

MUST lazy-load all route components for code splitting:

```typescript
const Page = lazy(() =>
  import('../features/domain/Page').then((m) => ({ default: m.Page })),
)
```

### Navigation Data

- `navigation.ts` is the single source of truth for sidebar structure
- `NAV_GROUPS` defines icon rail groups and sub-menu items
- `findGroupForPath()` resolves active group from current URL
- Active path matching uses `startsWith` to support nested routes

## TanStack Query — Server State

### Setup

`QueryClientProvider` is in `main.tsx` with defaults:
- `staleTime: 30_000` (30 seconds)
- `retry: 1`

### Query Key Convention

```typescript
const ENTITY_KEY = ['entity-name'] as const

// With filters
const FILTERED_KEY = ['entity-name', { status: 'active' }] as const

// With ID
const DETAIL_KEY = ['entity-name', id] as const
```

### Hook Pattern

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

const ITEMS_KEY = ['items'] as const

export function useItems() {
  const queryClient = useQueryClient()

  const { data = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => api.items.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreatePayload) => api.items.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const error = queryError instanceof Error ? queryError.message : null

  return {
    items: data as readonly Item[],
    loading,
    error,
    createItem: async (input: CreatePayload) => {
      await createMutation.mutateAsync(input)
    },
  } as const
}
```

### Rules

- MUST define query keys as `const` arrays
- MUST use `invalidateQueries` after mutations (not manual refetch)
- MUST expose `mutateAsync` (not `mutate`) for async/await in components
- MUST map `queryError` to `string | null` for consumer simplicity
- MUST NOT call `useQuery` conditionally — use `enabled` option instead
