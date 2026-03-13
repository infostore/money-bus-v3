---
name: build
description: Full lifecycle command. PRD creation → PDCA planning → Implementation → Verification → Merge.
argument-hint: "{feature-description}"
disable-model-invocation: true
---

# Build

Orchestrate the complete feature lifecycle from requirements to merged code. Auto-detects completed phases for resume support.

## Usage

```
/build {feature-description}
/build --auto-approve {feature-description}
```

### `--auto-approve` Mode

When `--auto-approve` is set, build runs autonomously without user checkpoints:
- Phase 1: Skip `SP:brainstorming`, auto-approve PRD (if CRITICAL=0)
- Phase 2: Auto-approve plan
- Phase 5: Auto squash merge to main (skip option selection)

If CRITICAL issues persist after 3 fix-and-re-review cycles, build exits with BLOCKED status.

## When to Use

- Starting a new feature from scratch (no PRD yet)
- Resuming a feature in progress (auto-detects completed phases)
- With `--auto-approve`: called by `/evolve` or other autonomous orchestrators

For **bug fixes** from GitHub issues, use `/fix-issue {number}` instead — lighter workflow without PRD/PDCA.

For individual phases, use standalone skills:

- **Requirements**: `/create-prd`, `/review-prd`
- **Planning**: `/create-plan`, `/update-pdca`
- **Implementation**: `/tdd`
- **Verification**: `/review-code`, `/check-coverage`

## Phase Detection (Resume)

Before starting, detect current state and skip completed phases:

| Check | How | Result |
|-------|-----|--------|
| PRD | Search `docs/prds/features/` for matching slug | `approved` → skip Phase 1. `draft` → resume at review. Not found → Phase 1 |
| PDCA | Search `docs/pdca/` for matching slug + read `phase` field | Not found → Phase 2. `plan` → Phase 3. `do` → resume impl. `check` → Phase 4. `act` → Phase 5 |
| Branch | `git branch --show-current` | On `feat/{slug}` → skip branch creation. On `main` → create branch |

Report detected state. In interactive mode, confirm starting phase with user. In `--auto-approve` mode, proceed automatically.

## Flow

### Phase 1 — Requirements

1. **Design first** (interactive mode only):
   - If `--auto-approve`: skip brainstorming. The feature description must be detailed enough for direct PRD generation.
   - Otherwise: use `SP:brainstorming` (refine requirements → propose approach → design approval)
2. **Create & review PRD** using `create-prd` skill (creates file, assigns PRD-ID, fills 9 sections, runs review)
3. **Approval gate**:
   - If `--auto-approve`: CRITICAL=0 → auto-approve (set `status: approved`). CRITICAL>0 → fix PRD → re-review → retry up to 3 times → BLOCKED if still CRITICAL.
   - Otherwise: **USER CHECKPOINT**: Present PRD + review results. WAIT for approval.
4. **Create branch**: `git checkout -b feat/{slug}` (after PRD approval, not before)
5. **Commit**: `docs(prds): add PRD-FEAT-{NNN} {slug}`

### Phase 2 — Planning

6. **Create PDCA plan** using `create-plan` skill (validates PRD, creates file, fills Plan section, wave breakdown)
7. **Task breakdown** using `SP:writing-plans` (decompose into bite-sized tasks, 2-5 minute units)
7.5. **Create ADR** (optional): run `create-adr` skill when significant architectural decisions arise
     - Rule of thumb: if the next developer would ask "why was it done this way?", write an ADR
8. **Approval gate**:
   - If `--auto-approve`: auto-approve plan.
   - Otherwise: **USER CHECKPOINT**: Present plan (+ ADR if created). WAIT for approval.
9. **Commit**: `docs(pdca): add {slug} implementation plan`

### Phase 3 — Implementation

10. **Update PDCA** `phase: do` using `update-pdca` skill
11. **Extract task list from Plan** and repeat the loop below for each task:

    **Task loop** (repeat per task):

    a. **Implement via subagent** — run `tdd-guide` subagent via Agent tool
       - Context: full task text + related files + PRD-ID
       - Follow `SP:test-driven-development`: RED → GREEN → REFACTOR
       - Project domain skills (`guide-api`, `guide-database`, `guide-components`) are
         preloaded into `tdd-guide` agent via its `skills:` frontmatter — no extra action needed
       - Completion: tests passing + committed

    b. **Review via subagent** — quality review via `code-reviewer` agent
       - No issues → next task
       - CRITICAL/HIGH → dispatch fix subagent → re-review

12. **Build/type errors**: Run `build-error-resolver` agent

> **Context Management**: Subagents isolate implementation context naturally. Run `/compact` before Phase 4 — keep only review summaries. Use `SP:dispatching-parallel-agents` for independent tasks.

### Phase 4 — Verification

13. **Update PDCA** `phase: check` using `update-pdca` skill
14. **Run tests**: `npx vitest run --coverage`
    - All metrics (statements/branches/functions/lines) >= 80% → Step 16
    - Any metric below 80% → Step 15
15. **Coverage improvement**: `/check-coverage --fix` (iterative gap analysis + test generation)
16. **Full review** using `SP:dispatching-parallel-agents` (parallel review):
    - `review-code` skill (quality)
    - `review-security` skill (security)
    - `ui-review` skill (UI + accessibility)
    - `npx tsc --noEmit` (typecheck)
17. **PRD comment check** using `prd-comment-enforcer` agent
18. **Document validation** using `validate-docs` skill
19. **Completion verification** using `SP:verification-before-completion`

**Pass criteria**: CRITICAL = 0, HIGH <= 3. If not met → fix and re-run failed checks.

> **Context Management**: Run `/compact` before Phase 5. Keep only review result summaries.

### Phase 5 — Completion

20. **Update PDCA** `phase: act, status: completed` using `update-pdca` skill
21. **Commit**: Semantic commit format per `git-workflow` rule
22. **Finish branch**: Push → create PR via `gh pr create` → squash merge via `gh pr merge --squash --delete-branch` → checkout main → pull → verify sync. Always automatic, no user checkpoint needed.
23. **Summary**: Log completion summary (PRD-ID, PR number, merge commit).

## Failure Handling

| Failure | Action |
|---------|--------|
| PRD review has CRITICAL issues | Fix PRD → re-run `review-prd` → re-present. `--auto-approve`: 3 retries then BLOCKED |
| Tests fail in Phase 3 | Dispatch new implementer subagent (pass failure logs) → re-run tests |
| Phase 4 review fails pass criteria | Fix issues → re-run failed review(s) only |
| Build/type errors | Run `build-error-resolver` agent → retry |

## Superpowers Integration

| Phase | Superpowers Skill | Role |
|-------|------------------|------|
| Phase 1 | `brainstorming` | Question-design-approval process (interactive only) |
| Phase 2 | `writing-plans` | Bite-sized task decomposition |
| Phase 3 | `test-driven-development` | RED-GREEN-REFACTOR per task |
| Phase 3 | `dispatching-parallel-agents` | Independent tasks in parallel |
| Phase 4 | `dispatching-parallel-agents` | Quality/Security/UI parallel review |
| Phase 4 | `verification-before-completion` | Evidence-based completion check |
| Phase 5 | `finishing-a-development-branch` | Merge/PR/cleanup options |

## Session Boundaries

If a phase completes but context is running low:

1. Run `/save-session` to persist progress
2. Next session: `/build {same-description}` → Phase Detection auto-resumes

## Safety Checks

- NEVER skip phases — each phase must complete before the next begins
- NEVER auto-approve PRD or plan — UNLESS `--auto-approve` flag is set
- NEVER commit directly to `main` — always work on a feature branch
- ALWAYS run tests before moving from Phase 3 to Phase 4
- ALWAYS verify pass criteria (CRITICAL=0, HIGH<=3) before Phase 5
- In `--auto-approve` mode: ALWAYS stop (BLOCKED) after 3 failed fix-and-re-review cycles
