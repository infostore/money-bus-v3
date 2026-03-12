---
name: improve-architecture
description: Analyze project architecture for pattern compliance, structural issues, and documentation gaps. Generate PRDs and implement via /build.
argument-hint: "--count {number}"
---

# Improve Architecture

Analyze project architecture to discover pattern inconsistencies, structural issues, type mismatches, and documentation gaps. Generate improvement PRDs and implement them via `/build`.

## Usage

```
/improve-architecture --count 3
```

## Parameter

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--count` | 1 | Number of improvements to generate and implement |

## Flow

### Resume Check

1. Read `.claude/improve-architecture-queue.local.md` → if exists with unchecked items, skip to Implementation Phase
2. If not found → start Analysis Phase

### Analysis Phase

1. **Scan pattern compliance**:
   - Check `src/server/routes/` for API response format consistency (`ApiResponse<T>`)
   - Check `src/server/repositories/` for repository pattern adherence (constructor injection, typed returns)
   - Check `src/client/src/hooks/` for custom hook return type consistency
   - Check `src/client/src/components/` for props interface patterns (readonly, no `I` prefix)
   - Flag: inconsistent patterns, missing validation, raw HTML vs design system components

2. **Scan structural integrity**:
   - Check `src/shared/types.ts` → are server and client using same types? Any drift?
   - Check route files → do they follow single-responsibility (one domain per file)?
   - Check repository files → do they match the route domains?
   - Check component tree → flat vs over-nested? Feature-based grouping?
   - Flag: type drift, bloated files (>800 lines), circular dependencies

3. **Scan docs/ status**:
   - Read PRD frontmatter in `docs/prds/features/` → find `status: completed` with unchecked success metrics
   - Read PDCA files in `docs/pdca/` → find unresolved "Next Actions" in Act sections
   - Check ADRs in `docs/adrs/` → any pending decisions without resolution?
   - Flag: incomplete PRDs, stale PDCAs, missing ADRs for architectural choices

4. **Scan API design**:
   - Check route naming consistency (plural nouns, REST conventions)
   - Check error response format consistency across all routes
   - Check middleware ordering and composition
   - Flag: inconsistent naming, missing error handlers, middleware gaps

5. **Apply scoring**:

   | Factor | Weight | Description |
   |--------|--------|-------------|
   | Pattern compliance | 3x | API/component/repository conventions |
   | Structural integrity | 3x | Type safety, file organization, boundaries |
   | API design consistency | 2x | REST conventions, error format |
   | Documentation freshness | 2x | PRD/PDCA/ADR completeness |

   Score = Impact / Complexity, multiplied by weight

6. **Select top --count candidates**

7. **Write queue** to `.claude/improve-architecture-queue.local.md`:

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

### Pattern compliance
- Routes missing `ApiResponse<T>` envelope
- Components using raw HTML instead of design system components
- Repositories with inconsistent method signatures
- Hooks with mismatched return type patterns

### Structural improvements
- Shared types diverged between server and client usage
- Files exceeding 800-line limit needing extraction
- Missing domain boundaries (mixed concerns in single file)
- Prop drilling that should use context or composition

### API design
- Inconsistent route naming (singular vs plural, nesting depth)
- Missing or inconsistent error handling middleware
- Endpoints without input validation

### Documentation gaps
- Completed PRDs with unchecked success metrics
- PDCA plans with unresolved Act items
- Architectural decisions without ADR documentation

## Safety

- Analysis is read-only → never modify existing code during scan
- Each build runs on its own `feat/` branch
- USER CHECKPOINT before starting Implementation Phase
- BLOCKED items are skipped, not retried
