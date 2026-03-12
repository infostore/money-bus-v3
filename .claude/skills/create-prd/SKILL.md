---
name: create-prd
description: Generate PRD from requirements. Use when starting a new feature that needs formal requirements documentation.
argument-hint: "{feature-description}"
context: fork
agent: prd-generator
---

# PRD

Create a new PRD from template, fill content, and optionally review it.

## Usage

```
/create-prd {feature-description}
```

## When to Use

- Starting a new feature that needs formal requirements
- For the full lifecycle (PRD → PDCA → Code), use `/build` instead

## Process

### 0. Brainstorming (conditional)

Branch based on the level of detail in the provided `{feature-description}`:

- **1-2 lines or less (short feature name/description)** → run `superpowers:brainstorming`
  - Questions → design → proceed to Step 1 after user approval
- **Detailed requirements already provided** → proceed directly to Step 1

```
/create-prd "user authentication"             → brainstorming first
/create-prd "..." (detailed spec provided)    → proceed directly to PRD creation
```

### 1. Check Branch

If on `main`, create `prd/{slug}` branch (docs/prds/ is exempt from prd-gate, but a dedicated branch keeps history clean).

### 2. Validate & Create PRD File

- Check if `docs/prds/features/000-template.md` exists. If not, report error and STOP.
- Ensure the new feature name/slug is provided. If missing: ask user for the feature name.
- Verify `docs/prds/features/{slug}.md` does NOT already exist.
- List existing PRDs in `docs/prds/features/` (exclude `000-template.md`). Find the highest `PRD-FEAT-XXX` number. Assign the next sequential number (zero-padded to 3 digits).
- Read `docs/prds/features/000-template.md`.
- Create `docs/prds/features/{slug}.md` with template content.
- Update frontmatter fields:
  - `prd-id`: `PRD-FEAT-{NNN}`
  - `title`: Feature title (derived from slug or user input)
  - `created`: Today's date
  - `updated`: Today's date
  - `status`: `draft`
  - `implementation-status`: `not-started`

### 3. Fill Sections

Use `prd-generator` agent to fill all 9 template sections:

| # | Section | Purpose |
|---|---------|---------|
| 1 | **Overview** | Problem, proposed solution, expected impact (1-3 paragraphs) |
| 2 | **User Stories** | High-level user stories in As/Want/So format |
| 3 | **Scope** | In Scope / Out of Scope boundaries |
| 4 | **Detailed Stories** | Stories with acceptance criteria (Given/When/Then) |
| 5 | **Technical Design** | Architecture, data models, component breakdown |
| 6 | **Implementation Strategy** | Wave-based task breakdown with effort estimates |
| 7 | **Success Metrics** | Measurable success criteria (checkboxes) |
| 8 | **Dependencies** | External dependencies and prerequisites |
| 9 | **Risks** | Risk / Impact / Mitigation table |

### 4. Set Status

Set `status` to `draft`.

### 5. Review PRD

Run `review-prd` skill (4C Framework + persona analysis).

### 6. Present Results

Present PRD + review results to user:
- If CRITICAL issues found: recommend keeping `draft` status
- If no issues: ask user to set `status: approved`

## Safety Checks

- NEVER overwrite an existing PRD file.
- ALWAYS verify the template exists before reading it.
- ALWAYS assign a unique, sequential PRD-ID.
- NEVER auto-approve — new PRDs always start as `status: draft`.

## Agent

- **prd-generator**: PRD content authoring (fills all 9 template sections)

## Skill

- **review-prd**: Quality review with 4C Framework, persona simulation, and severity-based output
