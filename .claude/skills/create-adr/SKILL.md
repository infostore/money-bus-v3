---
name: create-adr
description: Creates a new Architecture Decision Record from template. Use when architectural decisions need documentation.
argument-hint: '<title>'
context: fork
agent: architect
---

## Workflow

### 1. Validate

- Check if `docs/adrs/template.md` exists. If not, report error and STOP.
- Ensure a title is provided. If missing: ask user for the decision title.
- Verify a file with the same slug does NOT already exist.

### 2. Determine ADR Number

- List existing files in `docs/adrs/` (exclude `template.md`).
- Find the highest `ADR-XXX` number from existing filenames.
- Assign the next sequential number (zero-padded to 3 digits: `001`, `002`, ...).

### 3. Create ADR File

- Read `docs/adrs/template.md`.
- Create `docs/adrs/{NNN}-{slug}.md` (e.g., `001-use-sqlite-wal-mode.md`).
- Update frontmatter fields:
  - `adr-id`: `ADR-{NNN}` (e.g., `ADR-001`)
  - `title`: User-provided decision title
  - `status`: `proposed`
  - `created`: Today's date (YYYY-MM-DD)

### 4. Fill Template Sections

The ADR template has 3 sections to fill:

| Section | Content | Guidance |
|---------|---------|----------|
| **Context** | What problem or situation motivates this decision? | Include constraints, requirements, forces at play |
| **Decision** | What is the change being proposed or made? | State clearly: "We will use X" or "We will adopt Y" |
| **Consequences** | What becomes easier or harder after this decision? | List both positive and negative consequences |

- Ask user for input on each section, or offer to draft based on discussion context.

### 5. Finalize

- Confirm file creation with full path.
- Display the ADR-ID for reference.
- Remind: ADR status lifecycle is `proposed` → `accepted` → `deprecated` / `superseded`.

## ADR Status Values

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion, not yet decided |
| `accepted` | Decision adopted and in effect |
| `deprecated` | No longer relevant |
| `superseded` | Replaced by a newer ADR (link to replacement) |

## Safety Checks

- NEVER overwrite an existing ADR file.
- ALWAYS ensure unique, sequential ADR numbers.
- ALWAYS use kebab-case for the slug portion of the filename.
- NEVER auto-fill Context/Decision/Consequences without user input — these represent architectural decisions that require human judgment.

## When to Use

- When making an architectural decision that future developers will question ("why was it done this way?")
- New database schema design, external API integration approach, global state management changes
- Called optionally by `build` Phase 2 (Step 7.5) when architectural decisions arise
- Any decision that significantly constrains or shapes future development
