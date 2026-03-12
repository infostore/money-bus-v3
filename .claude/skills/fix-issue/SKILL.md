---
name: fix-issue
description: Fix a GitHub issue end-to-end — from analysis to PR
disable-model-invocation: true
argument-hint: '<GitHub issue number or URL>'
---

Fix GitHub issue: $ARGUMENTS

## Superpowers Integration

```
superpowers:systematic-debugging (root cause analysis: reproduce → hypothesize → verify)
       │
       └→ fix-issue (project workflow: branch → test → fix → PR)
                │
                └→ superpowers:verification-before-completion (evidence-based verify in Step 6)
```

## Workflow

1. **Analyze** — `gh issue view $ARGUMENTS` to get issue details
2. **Diagnose** — Use `SP:systematic-debugging` methodology: reproduce the bug, form hypotheses, narrow root cause
3. **Branch** — `git checkout -b fix/{short-slug}`
4. **Test first** — Write a failing test that reproduces the issue
5. **Fix** — Implement the minimal fix
6. **Verify** — Use `SP:verification-before-completion`: run `npx vitest` and `npx tsc --noEmit`, confirm output before claiming success
7. **Commit** — `fix(scope): description (closes #$ARGUMENTS)`
8. **PR** — `gh pr create` with summary and test plan

## Failure Mode Handling

| Situation | Action |
|-----------|--------|
| Cannot reproduce | Check environment (DB state, config). Ask user for steps if unclear. |
| Multi-file fix needed | Map all affected files first. Fix root cause, then propagate. |
| Flaky test | Run 3x to confirm flakiness. Fix test isolation before fixing issue. |
| Type error cascade | Fix the source type first, then let tsc guide dependent fixes. |
| Fix breaks other tests | The fix exposed a latent bug. Fix both — don't revert the original fix. |

## Post-Fix Checklist

- [ ] All tests pass (`npx vitest`)
- [ ] No type errors (`npx tsc --noEmit`)
- [ ] Fix is minimal — no unrelated changes
- [ ] Commit message references issue number
- [ ] PR description includes root cause analysis
