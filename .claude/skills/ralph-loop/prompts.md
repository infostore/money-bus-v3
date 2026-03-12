# Ralph Loop Prompt Templates

Reusable prompt templates for common `/ralph-loop` patterns. Copy and customize for your project.

## TDD Feature Build

```markdown
# Task: [Feature Name]

## Goal
Implement [feature description] using test-driven development.

## Approach
1. Write failing tests first (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor for quality (IMPROVE)
4. Repeat for each component

## Constraints
- Follow TDD strictly: test before implementation
- Target 80%+ test coverage
- Do not modify unrelated files
- Use existing project patterns and conventions

## Checklist
- [ ] Unit tests for [component A]
- [ ] Implementation of [component A]
- [ ] Unit tests for [component B]
- [ ] Implementation of [component B]
- [ ] Integration tests
- [ ] Coverage verification (80%+)

## Progress Tracking
At the end of EVERY response, include:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do next>
---END_RALPH_STATUS---
\`\`\`

## Exit Criteria
Set EXIT_SIGNAL: true when ALL checklist items are complete, tests pass, and coverage >= 80%.
```

## Bug Fix

```markdown
# Task: Fix [Bug Description]

## Goal
Diagnose and fix [bug description]. Root cause analysis required before fix.

## Approach
1. Reproduce the bug with a failing test
2. Investigate root cause
3. Implement minimal fix
4. Verify fix with passing test
5. Check for regressions

## Constraints
- Write a reproducing test FIRST
- Minimal change: fix only the bug, nothing else
- All existing tests must still pass
- Document root cause in commit message

## Progress Tracking
At the end of EVERY response, include:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do next>
---END_RALPH_STATUS---
\`\`\`

## Exit Criteria
Set EXIT_SIGNAL: true when: reproducing test passes, all other tests pass, root cause documented.
```

## Refactor

```markdown
# Task: Refactor [Target]

## Goal
Refactor [target module/component] to improve [readability/performance/maintainability].

## Approach
1. Verify all tests pass before starting
2. Apply refactoring in small, testable steps
3. Run tests after each step
4. Never change behavior (tests must stay green)

## Constraints
- No behavior changes: all existing tests must pass at every step
- Small commits: one refactoring concept per iteration
- If tests break, revert and try a different approach
- Follow existing project conventions

## Checklist
- [ ] Baseline: all tests passing
- [ ] [Refactoring step 1]
- [ ] [Refactoring step 2]
- [ ] [Refactoring step 3]
- [ ] Final: all tests passing, no behavior change

## Progress Tracking
At the end of EVERY response, include:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do next>
---END_RALPH_STATUS---
\`\`\`

## Exit Criteria
Set EXIT_SIGNAL: true when all checklist items complete and all tests pass.
```

## Coverage Improvement

```markdown
# Task: Improve Test Coverage

## Goal
Increase test coverage from [current]% to [target]% (minimum 80%).

## Approach
1. Run coverage report to identify gaps
2. Prioritize critical paths and edge cases
3. Write tests for uncovered lines/branches
4. Verify coverage improvement after each batch

## Constraints
- Focus on meaningful tests, not coverage gaming
- Test edge cases and error paths
- Do not modify source code (tests only)
- Each test should have a clear purpose

## Progress Tracking
At the end of EVERY response, include:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do next>
---END_RALPH_STATUS---
\`\`\`

## Exit Criteria
Set EXIT_SIGNAL: true when coverage >= [target]% and all tests pass.
```

## Tips for Writing Effective Prompts

1. **Be specific**: Vague goals lead to vague work. Define exact deliverables.
2. **Include a checklist**: Ralph uses checklist completion as a progress signal.
3. **Set clear exit criteria**: Tell Claude exactly when to set EXIT_SIGNAL: true.
4. **Add constraints**: Prevent scope creep by being explicit about boundaries.
5. **Use `--completion-promise`**: For critical tasks, require dual-condition exit.
6. **Keep prompts under 500 lines**: Shorter prompts produce more focused work.
