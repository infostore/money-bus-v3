---
name: review-prd
description: Reviews PRDs using 4C Framework and persona analysis. Use after drafting a PRD, before approval.
argument-hint: "<prd-file>"
context: fork
agent: prd-reviewer
---

## When to Use

- After drafting a new PRD with `/create-prd` — called automatically in step 5
- Before setting `status: approved` on any PRD
- When PRD changes are requested and quality needs re-evaluation
- Use `/review-prd <prd-file>` to review a specific file; omit argument to list all drafts

## Workflow

### 1. Pre-check

- Verify `status` in frontmatter. If `approved`, ask confirmation to re-review.
- Ensure the file follows the standard PRD template structure (9 sections: Overview → User Stories → Scope → Detailed Stories → Technical Design → Implementation Strategy → Success Metrics → Dependencies → Risks).
- If argument is missing: list PRDs in `docs/prds/features/` with `status: draft` and ask user to select.

### 2. Analyze 4C Framework

- **Clarity**: Identify ambiguous terms (e.g., "fast", "user-friendly", "simple", "intuitive"). Flag vague acceptance criteria.
- **Completeness**: Check for Happy Path, Edge Cases, Error States, Empty States, Loading States. Verify all 9 template sections are filled.
- **Feasibility**: Assess technical constraints, data availability, schema readiness. Flag if Technical Design references nonexistent APIs or tables.
- **Testability**: Verify acceptance criteria use Given/When/Then format and are measurable. Flag criteria that cannot be automated.

### 3. Simulate Personas

- **QA**: "How can I break this? What if inputs are invalid, empty, or exceed limits?"
- **Dev**: "Where does the data come from? Is the schema ready? Which repository methods exist?"
- **Designer**: "How does this look on mobile? What about long text, truncation, empty states?"
- **Skeptic User**: "Why do I need this feature? Is the value clear? Will I actually use it?"

### 4. Generate Report

Use the output format below. Categorize findings by severity.

### 5. Post-Review Action

- If **Critical Issues** found: Recommend keeping `status: draft` or setting to `changes-requested`.
- If **No Critical Issues**: Ask user if they want to update `status: approved` and `implementation-status: ready`.

## Output Format

```markdown
## PRD Review: {prd-id} — {title}

### CRITICAL (must fix before approval)
- [CRITICAL] Section {n}: {description of issue}
  → Suggested fix: {concrete suggestion}

### HIGH (strongly recommended)
- [HIGH] Section {n}: {description}
  → Suggested fix: {suggestion}

### MEDIUM (nice to have)
- [MEDIUM] Section {n}: {description}

### 4C Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Clarity | Pass/Fail | {key finding} |
| Completeness | Pass/Fail | {missing sections or states} |
| Feasibility | Pass/Fail | {technical blockers} |
| Testability | Pass/Fail | {unmeasurable criteria} |

### Persona Flags
- **QA**: {top concern}
- **Dev**: {top concern}
- **Designer**: {top concern}
- **Skeptic**: {top concern}

### Verdict
- Issues: {count} (CRITICAL: {n}, HIGH: {n}, MEDIUM: {n})
- Recommendation: APPROVE / REVISE / MAJOR REVISION
```

## Safety Checks

- ALWAYS provide constructive feedback, not just criticism.
- ALWAYS reference specific sections or lines in the PRD.
- NEVER assume implementation details unless specified.
- NEVER auto-approve — always present findings and let user decide.

## Agent

- **prd-reviewer**: 4C Framework analysis and persona simulation (model: sonnet)
