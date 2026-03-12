---
name: tdd
description: Test-driven development workflow with Vitest. Use when implementing new features or fixing bugs to ensure test coverage from the start.
argument-hint: "{feature-or-function}"
context: fork
agent: tdd-guide
---

# TDD

Run Test-Driven Development workflow with project-specific patterns. RED-GREEN-REFACTOR cycle targeting 80%+ coverage.

## Usage

```
/tdd {feature-or-function}
```

## When to Use

- Implementing a new feature or function with tests
- Fixing a bug (write regression test first, then fix)
- For the full lifecycle (PRD → PDCA → Code), use `/build` instead

If argument is missing: ask user what feature or bug to target.

## Superpowers Integration

The Superpowers `test-driven-development` skill provides the RED-GREEN-REFACTOR methodology.
This local skill adds project-specific patterns (in-memory SQLite, Hono test helpers, seeding, coverage targets).

```
superpowers:test-driven-development (methodology: RED → GREEN → REFACTOR)
       │
       └→ tdd (project patterns: Vitest + in-memory SQLite + Hono integration tests)
```

## Process

### 1. Determine Test Type

| What you're building | Test type | Location |
|---------------------|-----------|----------|
| Repository method, service logic | Unit test | `tests/unit/{subject}.test.ts` |
| API route handler | Integration test | `tests/integration/{subject}-api.test.ts` |
| Full feature (both) | Both | Start with unit, then integration |

### 2. RED — Write Failing Test

- Create test file following project naming: `{subject}.test.ts`
- Use in-memory SQLite pattern (see templates below)
- Write test describing expected behavior — it MUST fail initially

### 3. GREEN — Implement Minimum Code

- Write the simplest code that makes the test pass
- No extras — just enough to go green

### 4. REFACTOR — Clean Up

- Remove duplication, improve naming, extract constants
- All tests must still pass after refactoring

### 5. Verify

- Run `npx vitest run` — all tests pass
- Run `npx vitest run --coverage` — check coverage >= 80%
- If coverage gaps: add tests for untested branches/paths

### 6. Repeat

Next behavior → new failing test → implement → refactor.

## Project Test Structure

```
tests/
  unit/           # Repository and service logic tests
  integration/    # HTTP route/API tests via Hono
```

- Tests are NOT co-located with source files.
- File naming: `{subject}.test.ts` (e.g., `item-repository.test.ts`, `items-api.test.ts`)
- Unit tests: one `describe` per class/module
- Integration tests: one `describe` per route group

## Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/server/database/migrations'
import { MyRepository } from '../../src/server/database/my-repository'

describe('MyRepository', () => {
  let db: Database.Database
  let repo: MyRepository

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    repo = new MyRepository(db)
    // Seed required FK dependencies here
  })

  afterEach(() => {
    db.close()
  })

  it('should create and retrieve an item', () => {
    const created = repo.create({ name: 'test', value: 100 })
    expect(created.id).toBeDefined()

    const found = repo.findById(created.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('test')
  })

  it('should return undefined for non-existent id', () => {
    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })
})
```

## Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/server/database/migrations'
import { MyRepository } from '../../src/server/database/my-repository'
import { createMyRoutes } from '../../src/server/routes/my-routes'

describe('My API', () => {
  let db: Database.Database
  let app: Hono

  const createPayload = (overrides = {}) => ({
    name: 'test',
    value: 100,
    ...overrides,
  })

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    const repo = new MyRepository(db)
    app = new Hono()
    app.route('/api/my-resource', createMyRoutes(repo))
  })

  afterEach(() => {
    db.close()
  })

  it('POST /api/my-resource — creates resource (201)', async () => {
    const res = await app.request('/api/my-resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload()),
    })
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('test')
  })

  it('POST /api/my-resource — rejects invalid payload (400)', async () => {
    const res = await app.request('/api/my-resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('DELETE /api/my-resource/:id — returns 404 for missing', async () => {
    const res = await app.request('/api/my-resource/999', {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })
})
```

## Seeding Patterns

**FK dependencies** (required by most repositories):
```typescript
// Via repository methods (preferred — type-safe)
const category = categories.create({ name: 'test-category', code: 'TEST' })
const item = items.create({ name: 'test-item', category_id: category.id })

// Via direct SQL (for complex fixtures)
function seedDependencies(db: Database.Database) {
  db.prepare("INSERT INTO categories (name, code) VALUES ('test', 'TEST')").run()
}
```

## Mocking (Service Tests Only)

```typescript
import { vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

// Spy on async method
vi.spyOn(service, 'process').mockResolvedValue({ count: 50, failed: 2 })

// Spy on rejection
vi.spyOn(service, 'process').mockRejectedValue(new Error('API timeout'))

// Mock object
const mockProcessor = {
  run: vi.fn().mockResolvedValue({ count: 5, failed: 0 }),
}
```

Repository and pure logic tests should NOT use mocking — use in-memory DB instead.

## Test Checklist

| Category | What to test |
|----------|-------------|
| Happy path | Standard CRUD operations succeed |
| Validation | Missing/invalid fields return 400 |
| Not found | Nonexistent IDs return 404 or undefined |
| FK constraints | Invalid foreign key references are caught |
| Edge cases | Empty lists, zero values, boundary conditions |
| Idempotency | Duplicate creates handled (unique constraints) |

## Common Mistakes

### WRONG: Testing Implementation Details

```typescript
// Testing internal state directly
expect(repo['_cache'].size).toBe(5)
```

### CORRECT: Test User-Visible Behavior

```typescript
// Test user-visible results
const result = repo.findAll()
expect(result).toHaveLength(5)
```

### WRONG: No Test Isolation

```typescript
// Inter-test dependency (shared DB state)
it('creates user', () => { repo.create({ name: 'A' }) })
it('finds the user above', () => { expect(repo.findAll()).toHaveLength(1) }) // depends on test above
```

### CORRECT: Independent Tests

```typescript
// Each test sets up data independently
it('creates user', () => {
  const created = repo.create({ name: 'A' })
  expect(created.id).toBeDefined()
})

it('finds users', () => {
  repo.create({ name: 'B' })
  expect(repo.findAll()).toHaveLength(1)
})
```

### WRONG: Mocking What You Own

```typescript
// Mocking DB in repository tests
const mockDb = { prepare: vi.fn() }
```

### CORRECT: In-Memory DB for Integration

```typescript
// Use real in-memory DB (Repository, pure logic)
const db = new Database(':memory:')
runMigrations(db)
const repo = new MyRepository(db)
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Code coverage | >= 80% |
| All tests passing | green |
| No skipped/disabled tests | 0 |
| Unit test speed | < 50ms each |
| Test isolation | Each test can run independently |
| Edge case coverage | null, empty, boundary, FK constraints |

## Running Tests

```bash
npx vitest run                        # Run all tests
npx vitest                            # Watch mode
npx vitest run --coverage             # With coverage report
npx vitest run tests/unit/            # Unit tests only
npx vitest run tests/integration/     # Integration tests only
```

## Safety Checks

- NEVER write implementation code before a failing test exists
- NEVER skip the RED step — test must fail first to prove it tests the right thing
- ALWAYS run full test suite after refactoring to catch regressions
- NEVER mock what you own — use in-memory DB for repository and pure logic tests

## Agent

- **tdd-guide**: TDD workflow guidance and test quality review
