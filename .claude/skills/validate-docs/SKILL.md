---
name: validate-docs
description: Validates PRD and PDCA frontmatter schema compliance. Use before commits or when documents seem inconsistent.
argument-hint: "[target=prd|pdca|all] [file=<path>]"
---

# Validate Docs

Read-only validation of PRD and PDCA documents against the project's frontmatter schema. Never modifies files.

## Usage

```
/validate-docs                        # validates all PRDs + PDCAs
/validate-docs target=prd             # validates all PRDs
/validate-docs target=pdca            # validates all PDCAs
/validate-docs file=docs/prds/features/001-example.md   # single file
```

## Workflow

### 1. Determine Target

- If `file=` provided: validate that single file (auto-detect type from frontmatter `type:` field)
- If `target=prd`: scan `docs/prds/features/*.md` (exclude `000-template.md`, `template.md`)
- If `target=pdca`: scan `docs/pdca/*.md` (exclude `template.md`)
- If `target=all` or no argument: validate both PRDs and PDCAs

### 2. PRD Validation

For each PRD file, check in order:

**2a. Frontmatter Exists**
- File must start with `---` and contain YAML frontmatter
- Report error if missing or malformed

**2b. Required Fields**
- `type` (must be `prd`)
- `prd-id` (must match `PRD-FEAT-\d{3}`)
- `prd-type` (must be one of: `feature`, `roadmap`, `implementation`)
- `title` (non-empty string)
- `status` (must be one of: `draft`, `in-review`, `approved`, `implemented`, `deprecated`)
- `implementation-status` (must be one of: `not-started`, `in-progress`, `completed`, `blocked`)
- `created` (must be `YYYY-MM-DD` format)
- `updated` (must be `YYYY-MM-DD` format)

**2c. Cross-Check**
- If `status: approved` but `implementation-status: not-started` → INFO (normal)
- If `status: draft` but `implementation-status: completed` → WARN (inconsistent)
- If `implementation-status: completed` but `status` is not `approved` or `implemented` → WARN

**2d. File Path**
- Must be in `docs/prds/features/`
- Filename should be `NNN-{slug}.md` where NNN matches the numeric part of `prd-id`

### 3. PDCA Validation

For each PDCA file, check in order:

**3a. Frontmatter Exists**
- Same as PRD check

**3b. Required Fields**
- `type` (must be `pdca-plan`)
- `plan-name` (non-empty string)
- `related-prd` (must match `PRD-FEAT-\d{3}`)
- `phase` (must be one of: `plan`, `do`, `check`, `act`)
- `status` (must be one of: `not-started`, `in-progress`, `completed`, `blocked`)
- `created` (must be `YYYY-MM-DD` format)
- `updated` (must be `YYYY-MM-DD` format)

**3c. Cross-Check**
- `related-prd` should reference an existing PRD file in `docs/prds/features/`
- If `phase: act` and `status: not-started` → WARN (inconsistent)
- If `status: completed` but `phase` is not `act` → WARN (premature completion)

**3d. File Path**
- Must be in `docs/pdca/`
- Filename should contain the slug from the related PRD

### 4. Report

Output a summary table:

```
## Validation Results

| Category | Total | Passed | Issues |
|----------|-------|--------|--------|
| PRDs     | {n}   | {n}    | {n}    |
| PDCAs    | {n}   | {n}    | {n}    |

### Issues Found

**ERROR** {file}
  - {description}

**WARN** {file}
  - {description}
```

Severity levels:
- **ERROR**: Missing required field, invalid enum, malformed frontmatter
- **WARN**: Inconsistent cross-field values, path naming issues
- **INFO**: Advisory notes (not reported unless verbose)

## Safety Checks

- NEVER modify any file — this is a read-only validation skill
- Report all findings without fixing them
- If a file cannot be parsed, report the parsing error and continue to next file
- Do not stop on first error — validate all files and report all issues

## Error Handling

- **File not found**: "File not found: {path}"
- **Frontmatter missing**: "No YAML frontmatter found in {path}"
- **Invalid YAML**: "Frontmatter parse error in {path}: {description}"
- **Directory not found**: "Directory not found: {path}. Is this the project root?"

## When to Use

- Called by `build` Phase 4 (Step 18) before completion
- Before merging a feature branch to verify doc consistency
- When PRD or PDCA documents seem inconsistent after manual edits
- As a sanity check after bulk PRD/PDCA updates
