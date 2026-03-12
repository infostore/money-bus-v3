# PRD Comment Standard — Examples

Reference guide for PRD comment formats with code examples.

> **Adoption status:** PRD comments have not yet been widely applied. Adding relevant PRD comments when modifying code is recommended.

## Comment Formats

### 1. Single-Line (Preferred)

```typescript
// PRD-FEAT-001: Design system token enforcement
export const SEMANTIC_COLORS = { ... }

// PRD-FEAT-002: Core dashboard summary cards
export function DashboardSummary() { ... }
```

### 2. Multi-Line (Complex Features)

```typescript
/* PRD-FEAT-003: Data Visualization
 * Chart components with responsive layout
 */
export const DataChart: React.FC = () => { ... }
```

### 3. JSDoc (API Documentation)

```typescript
/**
 * Filters items by category and date range
 * @prd PRD-FEAT-004 - Item Category Filter
 */
export async function filterItems(...) { ... }
```

### 4. File Header (New Files)

```typescript
/**
 * Item detail page
 * PRD-FEAT-005: Item Management
 */
import React from 'react'
```

## Placement

- **File-level**: Top of file, before imports
- **Function/Class**: Immediately above declaration
- **Component**: JSDoc format above component

## Multiple PRDs

```typescript
/* PRD-FEAT-005: Item Management
 * PRD-FEAT-006: Analytics Dashboard
 */
export function calculateMetrics() { ... }
```

## Updating References

```typescript
/* PRD-FEAT-005: Item Management (Extended)
 * Originally: Display items
 * Extended: Added real-time updates — see Change Log v1.2
 */
```

## Anti-Patterns

```typescript
// BAD: Vague
// PRD: Item stuff

// GOOD: Specific
// PRD-FEAT-005: Calculate total item value
```

## PRD ID Reference Table

| PRD ID | Feature |
|--------|---------|
| PRD-FEAT-001 | Design System |
| PRD-FEAT-002 | Core Dashboard |

Full PRD list: `docs/prds/features/`
