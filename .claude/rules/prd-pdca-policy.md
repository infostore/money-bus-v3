# PRD-PDCA Policy (MANDATORY)

## The Rule

**EVERY code change** under `src/` or `tests/` requires this exact order:

```
1. PRD exists in docs/prds/features/    → If not, STOP and create one
2. PDCA plan exists in docs/pdca/       → If not, STOP and create one
3. Feature branch created               → NEVER commit to main
4. Implementation on branch             → Atomic commits
5. PR to merge                          → NEVER direct push to main
```

**NO EXCEPTIONS.** Not for "small" changes, "quick fixes", refactors, or UI tweaks.

## Pre-Flight Checklist

Before writing ANY code (editing files under `src/` or `tests/`), you MUST answer:

| # | Check | Action if NO |
|---|-------|--------------|
| 1 | Does a PRD exist for this work? | STOP. Create PRD first. |
| 2 | Does a PDCA plan exist? | STOP. Create PDCA first. |
| 3 | Am I on a feature branch? | STOP. Create branch first. |
| 4 | Is my branch name correct? | Use `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` prefix. |

## What Counts as "Code Change"

- Adding/modifying/deleting files under `src/`
- Adding/modifying/deleting files under `tests/`
- Adding/modifying dependencies in `package.json`
- Modifying Docker configuration
- Modifying database schema or migrations

## What Does NOT Require PRD

- Editing files under `docs/prds/`, `docs/pdca/`, `.claude/`
- Updating `CLAUDE.md`, `README.md`
- Git operations (branching, merging)

## Branch Rules

| Rule | Enforcement |
|------|-------------|
| NEVER commit to `main` | Always use feature branches |
| NEVER push directly to `main` | Always use PRs |
| Branch naming | `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` + slug |
| One feature per branch | Do not mix unrelated changes |

## Violation Recovery

If you realize you committed to `main` by mistake:
1. Do NOT push
2. Create the proper branch from current HEAD
3. Reset main to origin/main
4. Continue work on the feature branch
