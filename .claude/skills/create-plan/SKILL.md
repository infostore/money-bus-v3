---
name: create-plan
description: Create a PDCA implementation plan for an approved PRD.
argument-hint: "{prd-id-or-description}"
context: fork
agent: planner
---

# Plan

Create a PDCA implementation plan for an approved PRD. Break down into waves, identify dependencies, and WAIT for user confirmation.

## Usage

```
/create-plan {prd-id-or-description}
```

## When to Use

- After a PRD has been approved (`status: approved`)
- For the full lifecycle (PRD → PDCA → Code), use `/build` instead

## Superpowers Integration

The Superpowers `writing-plans` skill provides bite-sized task decomposition.
Follow the planning structure of writing-plans, but actual file creation is handled by this skill.

```
superpowers:writing-plans (task decomposition principles)
       │
       └→ create-plan (PDCA file creation + Wave breakdown + planner agent)
```

Calling `/create-plan` directly without writing-plans also works.

## Process

### 1. Find & Verify PRD

Find PRD in `docs/prds/features/` matching the argument (by PRD-ID, slug, or keyword):
- If `approved` → proceed
- If `draft` → STOP. Inform: "PRD is still in draft. Run `/review-prd` to review, then approve before planning."
- If not found → STOP. Inform: "No matching PRD found. Run `/create-prd {description}` to create one."

### 2. Validate & Create PDCA File

- Check if `docs/pdca/template.md` exists. If not, report error and STOP.
- Verify `docs/pdca/{slug}.md` does NOT already exist.
- Verify the referenced PRD has `status: approved`. If not: warn and ask for confirmation.
- Read `docs/pdca/template.md`.
- Create `docs/pdca/{slug}.md` with template content.
- Update frontmatter fields:
  - `plan-name`: Descriptive name (from slug or PRD title)
  - `related-prd`: `PRD-FEAT-{NNN}`
  - `created`: Today's date
  - `updated`: Today's date
  - `phase`: `plan`
  - `status`: `not-started`

### 3. Fill Plan Section

Fill the Plan section with content derived from the PRD:

| Field | Guidance | Example |
|-------|----------|---------|
| **Goal** | One sentence: what this cycle achieves. Derive from PRD Overview. | "Implement user authentication to secure API endpoints" |
| **Scope** | Break into task groups aligned with PRD Implementation Strategy waves. | "Wave 1: DB schema + API, Wave 2: Frontend components" |
| **Success Metrics** | Copy from PRD Section 7, or create measurable criteria. | "[ ] Login flow completes in < 2s" |

### 4. Break into Waves

Use `planner` agent for wave-based implementation breakdown with effort estimates and dependency analysis.

### 5. Present & Confirm

Present plan to user and WAIT for approval:
- If changes requested: revise and re-present
- Remind: Use `/update-pdca` to transition phases as work progresses (`plan` → `do` → `check` → `act`).

## Safety Checks

- NEVER overwrite an existing PDCA plan.
- ALWAYS link to a valid PRD-ID.
- NEVER start with phase other than `plan`.

## Agent

- **planner**: Wave-based implementation planning with dependency analysis
