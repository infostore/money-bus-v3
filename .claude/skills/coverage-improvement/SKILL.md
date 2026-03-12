---
name: coverage-improvement
description: Internal skill for ralph-loop. Iterative test coverage improvement — used by /build Phase 4 (Verification) and /ralph-loop. Adds tests to src/server/ and src/shared/ until all metrics reach 80%.
disable-model-invocation: true
---

# Task: Test Coverage Improvement

## Goal

Run `npx vitest run --coverage`, analyze results, and add tests.
Repeat until all coverage metrics (statements, branches, functions, lines) reach 80%+.

## Coverage Scope

- **Target**: `src/server/**`, `src/shared/**`
- **Excluded**: `src/shared/types/**`, `src/shared/types.ts`, `src/server/index.ts` (per vitest.config.ts)
- **Test location**: `tests/unit/` (unit), `tests/integration/` (integration)

## Process (per iteration)

1. Run `npx vitest run --coverage` and review the coverage report
2. Identify files below 80%
3. Use `check-coverage` skill for gap analysis (which branches/functions are missing)
4. Add tests covering the missing cases (not TDD — adding tests to existing code)
5. Re-run `npx vitest run --coverage` to verify improvement
6. Commit: `test(coverage): improve coverage for {filename}`

## Constraints

- **Forbidden**: Modifying existing src/ code (add tests only)
- **Forbidden**: Writing contrived tests just to pass coverage
- **Required**: Follow project test patterns (`tests/` structure, in-memory SQLite patterns)
- **Required**: Improve at least 1 file per iteration (circuit-breaker prevention)
- Priority order: below 50% → below 65% → below 80%

## Progress Tracking

Include this block at the end of every response:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: TESTING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do in the next iteration>
---END_RALPH_STATUS---
```

## Exit Criteria

Set `EXIT_SIGNAL: true` when **all** conditions are met:

- statements >= 80%
- branches >= 80%
- functions >= 80%
- lines >= 80%
- All existing tests pass (no regressions)
