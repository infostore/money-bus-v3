---
name: review-code
description: Comprehensive code review for quality, security, and best practices.
argument-hint: "[scope]"
context: fork
agent: code-reviewer
---

# Code Review

Review code for quality, security, performance, and adherence to project conventions.

## Usage

```
/review-code [scope]
```

## Scope

| Scope | What gets reviewed |
|-------|-------------------|
| (none) | All uncommitted changes (`git diff` + `git diff --cached`) |
| `src/server/` | Server-side code only |
| `src/client/` | Client-side code only |
| `{file-path}` | Specific file |
| `--staged` | Only staged changes |

## When to Use

- After implementing a feature, before committing
- Before creating a PR
- For the full lifecycle (PRD → Code → Review), use `/build` instead

## Superpowers Integration

Independent review steps (Quality, Security, TypeScript) can be executed concurrently via `superpowers:dispatching-parallel-agents`.
Sequential execution also works, but parallel execution is faster for large-scale changes.

## Process

### 1. Quality Review

Run `code-reviewer` agent. Checks:
- Code standards compliance (immutability, naming, file/function size limits)
- Design token usage (no hardcoded colors)
- Component patterns (design system components vs raw HTML)
- TypeScript strictness (no `any`, explicit return types)

### 2. Security Review

Run `security-reviewer` agent with `review-security` skill (8 categories, includes severity classification — see `review-security` skill for detailed checklist).

### 3. TypeScript Check

```bash
npx tsc --noEmit
```

### 4. Test Verification

```bash
npx vitest run --coverage
```

Report coverage percentage. Flag files below 80%.

### 5. UI Review (if applicable)

If scope includes `src/client/`: run `ui-review` skill for design system compliance.

### 6. Accessibility Review (if applicable)

If scope includes `src/client/` or `.tsx` files: check accessibility guidelines.
Priority checks:
- **Critical**: Accessible names on interactive controls, keyboard access, focus management
- **High**: Semantic HTML (native elements over role hacks), form error linking (`aria-describedby`)
- **Medium**: `aria-live` for dynamic content, contrast, hover-only interactions

### 7. Performance Review (if applicable)

Identify performance issues:
- **JavaScript**: Unnecessary bundle weight, missing code splitting, tree-shaking opportunities
- **Images**: Missing `loading="lazy"`, no `fetchpriority="high"` on LCP images
- **Runtime**: Layout thrashing, un-debounced scroll/resize handlers, missing `requestAnimationFrame`

### 8. Present Results

Use output format below. Aggregate findings from all reviews.

## Output Format

```markdown
## Code Review: {scope}

### Quality
- [CRITICAL/HIGH/MEDIUM] {file}:{line} — {description}

### Security
- [CRITICAL/HIGH/MEDIUM] {file}:{line} — {category}: {description}

### TypeScript
- {file}:{line} — {error message}
- or "Clean — no type errors"

### Test Coverage
- Overall: {percentage}%
- Below threshold: {file} ({percentage}%)
- or "All files above 80%"

### UI (if reviewed)
- {findings from ui-review skill}

### Accessibility (if reviewed)
- [CRITICAL/HIGH/MEDIUM] {file}:{line} — {category}: {description}
- or "No accessibility issues found"

### Performance (if reviewed)
- [HIGH/MEDIUM] {file}:{line} — {category}: {description}
- or "No performance issues found"

### Summary
| Category | CRITICAL | HIGH | MEDIUM |
|----------|----------|------|--------|
| Quality | {n} | {n} | {n} |
| Security | {n} | {n} | {n} |
| Total | {n} | {n} | {n} |

**Verdict**: PASS / FAIL (FAIL if any CRITICAL or >3 HIGH)
```

## Safety Checks

- NEVER approve code with CRITICAL severity issues
- ALWAYS run all applicable review steps for the given scope
- NEVER skip security review — it applies to all server code changes
- ALWAYS report pass/fail verdict based on objective criteria (CRITICAL=0, HIGH≤3)

## Agent

- **code-reviewer**: Quality and standards review
- **security-reviewer**: Security vulnerability detection (8 categories)

## Skill

- **review-security**: Security scan with Grep detection patterns and severity classification
- **ui-review**: Design system compliance with token/component checks (if client code in scope)
