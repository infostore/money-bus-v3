---
name: update-pdca
description: Updates phase, status, and progress log in a PDCA plan. Use when transitioning implementation phases.
argument-hint: "<slug> <phase> [status]"
---

## Workflow

### 1. Validate

- Ensure the target file exists in `docs/pdca/`. If slug is missing: list PDCA plans in `docs/pdca/` (exclude `template.md`) and ask user to select.
- Verify it has `type: pdca-plan` in frontmatter.
- If phase argument is missing: show current phase and ask which phase to transition to.

### 2. Execute

- Update frontmatter: `phase`, `status`, `updated` (today's date).
- Add progress log entry: `- YYYY-MM-DD: {description}`.

### 3. Phase-Specific Actions

| Transition | Pre-condition | Action |
|------------|---------------|--------|
| `plan` → `do` | Plan section is filled (Goal, Scope, Metrics) | Set `status: in-progress`. Add tasks to Do section. |
| `do` → `check` | Tasks in Do section are completed | Fill Check section: Results and Evidence. |
| `check` → `act` | Check section has results | Fill Act section: Learnings and Next Actions. |
| `act` → completed | Act section is filled | Set `status: completed`. Full cycle done. |

### 4. Confirm

- Show updated phase and status.
- If not yet completed: remind what the next phase transition requires.

## Allowed Values

| Field | Values |
|-------|--------|
| `phase` | `plan`, `do`, `check`, `act` |
| `status` | `not-started`, `in-progress`, `completed`, `blocked` |

## Safety Checks

- Only modify `phase`, `status`, `updated` in frontmatter and append to progress logs.
- NEVER delete existing content.
- ALWAYS append to progress logs, never overwrite.
- NEVER skip phases — transitions must be sequential.

## When to Use

- Called by `build` skill when transitioning between phases (plan → do → check → act)
- After completing a development phase to record progress
- When documenting post-release fixes to a completed PDCA
