---
type: adr
adr-id: ADR-001
title: Adopt TanStack Router + Query for frontend routing and server state
status: accepted
created: 2026-03-12
---

# ADR-001: Adopt TanStack Router + Query for frontend routing and server state

## Status
Accepted

## Context

Money Bus v3 is projected to grow to 100+ views across 7+ feature domains (dashboard, assets, analysis, planning, tax, settings, system). The initial implementation used hash-based routing with manual `useState`/`hashchange` and custom fetch hooks with `useState`/`useEffect` for server state.

Problems with the initial approach at scale:
- **Routing**: No type-safe navigation, no URL parameters, no nested routes, no code splitting, no route-level data loading. A single `App.tsx` switch statement would grow to 100+ branches.
- **Server state**: Each feature duplicates loading/error/refetch boilerplate. No caching, no stale management, no automatic background refetching. Every hook reinvents the same `useState`/`useEffect`/`useCallback` pattern.

## Decision

### TanStack Router (`@tanstack/react-router`)

- **Code-based route definitions** (not file-based) — project uses non-standard `src/client` root, and code-based gives explicit control over route composition.
- **Domain-split route files**: Each nav domain (assets, tax, settings, etc.) owns its own route file under `routes/`. A central `routes/index.ts` assembles the tree.
- **Lazy-loaded route components**: All view components use `React.lazy()` for automatic code splitting.
- **Navigation data separated**: `navigation.ts` is the single source of truth for sidebar structure, decoupled from route definitions and layout components.
- **Nested routes ready**: Route files can add layout routes (pathless) and child routes as features grow, without touching other domains.

### TanStack Query (`@tanstack/react-query`)

- **QueryClientProvider** at app root with `staleTime: 30s`, `retry: 1`.
- **Convention**: `useQuery` for reads, `useMutation` + `invalidateQueries` for writes.
- **Query keys**: `const` arrays by entity name (e.g., `['family-members']`).
- **Hook API surface**: Hooks expose `data`, `loading`, `error`, and mutation functions — consumers don't interact with TanStack Query directly.

### What was NOT chosen

- **File-based routing** (TanStack Router plugin): Requires Vite plugin and specific directory conventions. Too rigid given our `src/client` root and the need for explicit route composition.
- **React Router**: Less type-safe, no first-class search params, weaker devtools.
- **SWR**: Similar to TanStack Query but smaller ecosystem, no integrated devtools, less mutation support.
- **Zustand/Redux for server state**: Server state belongs in a cache (TanStack Query), not a client state store. Client-only state can use `useState`/`useContext`.

## Consequences

### Easier
- Adding new views: create route in domain file + lazy component. No merge conflicts in a central file.
- Nested routes: `/accounts/$accountId/transactions` with shared layout — just add child routes.
- URL parameters: `$accountId`, search params — type-safe, validated by router.
- Caching: API responses cached and deduplicated automatically. Multiple components using the same query key share one fetch.
- Background refetching: Stale data served instantly, fresh data fetched in background.
- Code splitting: Each route is a separate chunk — initial bundle stays small as views grow.

### Harder
- Two new dependencies to maintain (`@tanstack/react-router`, `@tanstack/react-query`).
- Team must learn TanStack conventions (query keys, invalidation, route tree).
- Server-side rendering (if ever needed) requires additional TanStack SSR setup.
- Route type registration (`declare module '@tanstack/react-router'`) is boilerplate that must exist in `routes/index.ts`.
