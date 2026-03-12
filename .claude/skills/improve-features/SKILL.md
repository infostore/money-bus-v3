---
name: improve-features
description: Analyze code quality, dependencies, and modernization opportunities. Generate PRDs and implement via /build.
argument-hint: "--count {number}"
---

# Improve Code

Analyze the codebase for quality issues, outdated dependencies, security vulnerabilities, and modernization opportunities. Generate improvement PRDs and implement them via `/build`.

## Usage

```
/improve-features --count 3
```

## Parameter

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--count` | 1 | Number of improvements to generate and implement |

## Flow

### Resume Check

1. Read `.claude/improve-features-queue.local.md` → if exists with unchecked items, skip to Implementation Phase
2. If not found → start Analysis Phase

### Analysis Phase

1. **Scan code quality**:
   - Run `npx vitest run --coverage` and check metrics against 80% threshold
   - Run `npx tsc --noEmit` and count type errors
   - Run `npx eslint src/` and count lint violations
   - Flag: low coverage files, type errors, lint violations

2. **Scan dependencies & security**:
   - Run `npm outdated` to find outdated packages
   - Run `npm audit` to find known vulnerabilities
   - Check for unused dependencies (declared but not imported)
   - Flag: outdated deps, unused deps, security vulnerabilities

3. **Scan technology modernization**:
   - **Runtime**: Check Node.js version compatibility, suggest ES2024+ features (using, structuredClone, Array.groupBy)
   - **React**: Check for class components → function components, old lifecycle methods, missing React 19 features (use, Actions, Server Components readiness)
   - **Hono**: Check for deprecated middleware, suggest v4 features (streaming, WebSocket helpers, RPC mode)
   - **Vite**: Check vite.config.ts for deprecated options, suggest Vite 6 features (Environment API, module preloading)
   - **TypeScript**: Check tsconfig for outdated settings, suggest strict mode improvements, `satisfies` operator, `using` declarations
   - **Tailwind**: Check for v3 patterns that should migrate to v4 (CSS-first config, @theme directive)
   - **SQLite**: Check for missing WAL2, RETURNING clauses, window functions where applicable
   - Flag: deprecated APIs, missing modern alternatives, upgrade opportunities

4. **Scan code modernization**:
   - Find callback-based code that should use async/await
   - Find manual type guards that could use type predicates or assertion functions
   - Find repeated fetch patterns that should use a shared API client
   - Find components with prop drilling that should use context or composition
   - Find imperative DOM manipulation that should be declarative React
   - Flag: legacy patterns, missed language features, code smell

5. **Apply scoring**:

   | Factor | Weight | Description |
   |--------|--------|-------------|
   | Security vulnerabilities | 4x | npm audit critical/high findings |
   | Technology modernization | 3x | Outdated major versions, deprecated APIs |
   | Developer experience | 3x | Reduces friction, saves time |
   | Code modernization | 2x | Legacy patterns, missed language features |
   | Code quality | 2x | Coverage, type safety, lint compliance |

   Score = Impact / Complexity, multiplied by weight

6. **Select top --count candidates**

7. **Write queue** to `.claude/improve-features-queue.local.md`:

   ```markdown
   ---
   count: 3
   completed: 0
   created: YYYY-MM-DD
   ---

   ## Queue

   - [ ] **{type}: {title}**
     - description: {detailed description for /build, 3-5 sentences}
     - rationale: {why this improvement matters}
     - complexity: {Low|Medium|High}
     - source: {which scan found this}
   ```

### Implementation Phase

For each unchecked queue item:

1. **Read queue**: Find first unchecked `- [ ]` item
2. **Run build**: Execute `/build "{description field content}"`
3. **Handle result**:
   - Build succeeds → mark item `- [x]` in queue, increment `completed`
   - Build BLOCKED → mark item `- [BLOCKED]`, increment `completed`, move to next
4. **Check completion**: If `completed >= count` → done

## Candidate Types

### Security & dependency updates
- npm audit critical/high vulnerabilities
- Major version upgrades with breaking changes
- Deprecated packages with recommended replacements

### Technology modernization
- React 19 features adoption (use hook, Actions API, useOptimistic)
- Hono v4 features (RPC mode, streaming responses, WebSocket)
- Vite 6 migration (Environment API, CSS-first Tailwind config)
- TypeScript 5.x features (satisfies, using declarations, const type parameters)
- Node.js 22+ features (built-in test runner, native fetch improvements)

### Code modernization
- Callback-to-async/await migration
- Manual type assertions to type predicates
- Imperative DOM to declarative React patterns
- Raw SQL strings to query builder patterns

### Code quality improvements
- Files below 80% test coverage
- Modules with type errors
- Patterns not matching conventions

### Developer experience improvements
- Missing error handling in API routes
- Missing loading/error states in UI hooks
- Missing input validation on endpoints

## Safety

- Analysis is read-only → never modify existing code during scan
- Each build runs on its own `feat/` branch
- USER CHECKPOINT before starting Implementation Phase
- BLOCKED items are skipped, not retried
