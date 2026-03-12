---
name: pdca-plan
description: Create a PDCA (Plan-Do-Check-Act) tracking plan from template. Use when starting implementation of an approved PRD.
argument-hint: "<prd-id> [slug]"
---

# PDCA Plan

Create a new PDCA tracking plan linked to an approved PRD.

## Usage

```
/pdca-plan PRD-FEAT-017 user-settings
```

## When to Use

- After a PRD is approved (`status: approved`)
- Before starting any implementation work
- Called by `/build` Phase 2 if no PDCA exists

## Workflow

### 1. Validate

- Verify `docs/pdca/template.md` exists
- Parse PRD-ID from argument → verify PRD exists in `docs/prds/features/` with `status: approved`
- Derive slug from PRD title if not provided
- Verify PDCA does NOT already exist at `docs/pdca/{slug}.md`

### 2. Read PRD

- Extract from the PRD: title, scope, success metrics, technical design
- Use these to pre-fill PDCA Plan section

### 3. Create PDCA

- Read `docs/pdca/template.md`
- Create `docs/pdca/{slug}.md` with template content
- Fill frontmatter:
  - `plan-name`: derived from PRD title
  - `related-prd`: PRD-ID
  - `created`: today's date
  - `updated`: today's date
  - `phase`: plan
  - `status`: not-started

### 4. Fill Plan Section

- **Goal**: derived from PRD Overview
- **Scope**: derived from PRD Scope (In Scope items)
- **Success Metrics**: derived from PRD Success Metrics
- **Tasks**: break down PRD Detailed Stories into task checklist

### 5. Finalize

- Confirm file creation with path
- Remind: use `update-pdca` skill to transition phases as work progresses

## Safety Checks

- NEVER overwrite an existing PDCA plan
- ALWAYS validate PRD exists and is approved before creating
- ALWAYS link to a valid PRD-ID in frontmatter
