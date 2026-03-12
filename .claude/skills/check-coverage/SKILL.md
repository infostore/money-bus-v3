---
name: check-coverage
description: Analyze test coverage, generate missing tests, and verify improvement with before/after comparison.
argument-hint: "[scope] [--fix]"
context: fork
agent: coverage-analyzer
---

# Test Coverage

Analyze test coverage, identify gaps, and optionally generate missing tests to reach 80%+ threshold.

## When to Use

- After implementing new features, to verify test coverage meets 80% threshold
- In `build` Phase 4: called for coverage improvement
- With `--fix` flag: auto-generates missing tests and shows before/after improvement
- Without `--fix`: analysis-only mode — suggests tests but does not write any

## Usage

```
/check-coverage [scope] [--fix]
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `scope` | (full project) | Limit analysis to a path |
| `--fix` | off | Generate tests and verify before/after improvement |

## Scope

| Scope | What gets analyzed |
|-------|-------------------|
| (none) | Full project coverage |
| `src/server/` | Server-side coverage only |
| `src/client/` | Client-side coverage only |
| `{file-path}` | Specific file coverage |

## Process

### Phase 1: Analyze (always runs)

#### 1. Run Coverage (Before)

```bash
npx vitest run --coverage
```

Save the "before" metrics for later comparison.

#### 2. Analyze Results

- Parse coverage report (statements, branches, functions, lines)
- If scope is provided, filter to matching files only
- Identify files below 80% threshold
- Rank files by risk: untested business logic > untested utilities > untested types

#### 3. Identify Gaps

For each under-covered file, analyze:
- Which functions/methods lack tests
- Which branches are untested (if/else, switch cases, error paths)
- Which edge cases are missing

#### 4. Suggest Tests

For each gap, provide a specific test suggestion following project patterns:

| Gap Type | Test Suggestion |
|----------|----------------|
| Untested repository method | Unit test in `tests/unit/{repo}.test.ts` using in-memory SQLite |
| Untested route handler | Integration test in `tests/integration/{route}-api.test.ts` using `app.request()` |
| Untested error branch | Add test case with invalid input to existing describe block |
| Untested service logic | Unit test with `vi.spyOn()` mocking for external dependencies |
| Untested utility function | Unit test in `tests/unit/{util}.test.ts` with edge cases |

#### 5. Present Report

Output the structured coverage report (see Output Format below).

**If `--fix` is NOT specified, stop here.** Report suggestions only.

### Phase 2: Generate & Verify (only with --fix)

#### 6. Generate Tests

For each suggested test (top 5 by priority):
- Create or append to the appropriate test file
- Follow existing test patterns (describe blocks, helper functions, seed data)
- Focus on: happy path, error handling, edge cases (null, undefined, empty), boundary conditions

#### 7. Verify Tests Pass

```bash
npx vitest run
```

If any new test fails, fix the test (not the implementation) and re-run.

#### 8. Run Coverage (After)

```bash
npx vitest run --coverage
```

#### 9. Show Before/After Comparison

```markdown
### Before/After Comparison
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Statements | {n}% | {n}% | +{n}% |
| Branches | {n}% | {n}% | +{n}% |
| Functions | {n}% | {n}% | +{n}% |
| Lines | {n}% | {n}% | +{n}% |

Tests added: {count}
Files modified: {count}
```

## Output Format

```markdown
## Test Coverage Report

### Overall
| Metric | Coverage | Target | Status |
|--------|----------|--------|--------|
| Statements | {n}% | 80% | PASS/FAIL |
| Branches | {n}% | 80% | PASS/FAIL |
| Functions | {n}% | 80% | PASS/FAIL |
| Lines | {n}% | 80% | PASS/FAIL |

### Files Below Threshold
| File | Coverage | Gap | Priority |
|------|----------|-----|----------|
| {file} | {n}% | {80-n}% | HIGH/MEDIUM/LOW |

### Suggested Tests (top 5 by priority)
1. **{file}:{function}** — {what to test}
   - Type: {unit/integration}
   - Location: `tests/{unit|integration}/{name}.test.ts`
2. ...

### Summary
- Files below 80%: {count}/{total}
- Estimated tests to reach 80%: {count}
```

## Safety Checks

- NEVER modify source code when in analysis-only mode (without --fix)
- ALWAYS verify new tests pass before reporting coverage improvement
- NEVER game coverage with meaningless tests — focus on meaningful behavior verification

## Agent

- **coverage-analyzer**: Coverage analysis, gap identification, test suggestions (model: haiku)
- **tdd-guide**: Test improvement guidance and test quality review
