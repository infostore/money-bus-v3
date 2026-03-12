# Vercel React Best Practices Analysis

**Source:** Vercel Engineering (January 2026)

## Overview

React performance optimization guidelines. 57 rules classified into 8 categories, prioritized by impact level. Designed for AI agents to automatically reference during code generation/review/refactoring.

## Rule Categories (by priority)

### 1. Eliminating Waterfalls — CRITICAL

Parallelize independent async operations with `Promise.all()`. 2-10x improvement.

| Rule | Description |
|------|-------------|
| `async-defer-await` | Move `await` to the actual usage branch |
| `async-parallel` | Parallelize independent operations |

### 2. Bundle Size Optimization — CRITICAL

A single barrel import can cost 200-800ms in loading time.

| Rule | Description |
|------|-------------|
| `bundle-barrel-imports` | Direct imports instead of barrel files |
| `bundle-dynamic-imports` | Lazy load heavy components with `React.lazy()` |
| `bundle-defer-third-party` | Load analytics libraries after hydration |

### 3. Re-render Optimization — MEDIUM (12 rules)

| Rule | Description |
|------|-------------|
| `rerender-derived-state-no-effect` | Derive state during render (not in effects) |
| `rerender-functional-setstate` | Functional setState for stable callbacks |
| `rerender-lazy-state-init` | Pass function to `useState` for expensive initial values |
| `rerender-memo` | Isolate expensive operations into memoized components |
| `rerender-transitions` | Handle non-urgent updates with `startTransition` |

### 4. Rendering Performance — MEDIUM

| Rule | Description |
|------|-------------|
| `rendering-conditional-render` | Ternary instead of `&&` (prevent falsy 0/NaN rendering) |
| `rendering-hoist-jsx` | Extract static JSX outside components |
| `rendering-content-visibility` | Optimize long lists with `content-visibility` |

### 5. JavaScript Performance — LOW-MEDIUM (12 rules)

| Rule | Description |
|------|-------------|
| `js-tosorted-immutable` | Immutable sorting with `toSorted()` |
| `js-set-map-lookups` | O(1) lookups with Set/Map |
| `js-early-exit` | Early return from functions |
| `js-index-maps` | Build Map for repeated lookups |

### 6. Advanced Patterns — LOW

| Rule | Description |
|------|-------------|
| `advanced-event-handler-refs` | Store event handlers in refs |
| `advanced-init-once` | Initialize only once on app load |
| `advanced-use-latest` | Stable callback ref with `useLatest` |

## Hono + Vite Application Notes

This template uses Hono + React 19 + Vite (not Next.js). Next.js-specific rules (RSC, Server Actions) are referenced for principles only:

| Next.js Rule | Principle Application |
|------|----------------------|
| Server caching | Borrow in-request cache pattern for Hono routes |
| LRU cache | Apply to better-sqlite3 queries |
| Serialization | Return only required fields in API responses |
| Parallel fetching | Parallelize DB queries in Hono routes |

## Recommended Priority

| Rank | Rule | Reason |
|------|------|--------|
| 1 | `async-parallel` | Parallelize API calls on page load |
| 2 | `js-tosorted-immutable` | Aligns with immutability principle |
| 3 | `rerender-derived-state-no-effect` | Avoid deriving state in effects |
| 4 | `rendering-conditional-render` | Prevent 0-render bug |
| 5 | `js-set-map-lookups` | Optimize repeated lookups |
| 6 | `bundle-barrel-imports` | Direct imports for icon libraries |
