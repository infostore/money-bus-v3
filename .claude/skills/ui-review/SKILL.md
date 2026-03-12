---
name: ui-review
description: UI review for design system compliance and accessibility. Use after modifying UI components.
argument-hint: "[file-or-directory]"
context: fork
agent: general-purpose
---

## When to Use

- After modifying any React component or page in `src/client/`
- Before committing UI changes to verify design system compliance
- When reviewing hardcoded colors, raw HTML vs component usage, or accessibility issues
- Called in `build` Phase 4 step 16 parallel review

## Review Steps

1. **Hardcoded Color Scan** — See `patterns.md` for banned Tailwind patterns. Each match is **CRITICAL**.
2. **Hardcoded Hex Scan** — See `patterns.md` for inline hex detection. Exceptions: `CHART_COLORS` in design-tokens.ts.
3. **Component Usage Check** — See `patterns.md` for raw HTML → design system component mapping. **MEDIUM** violations.
4. **Semantic Color Consistency** — See `patterns.md` for data context → token mapping. **HIGH** violations.
5. **Accessibility Check** — Focus states, color-only indicators, contrast (WCAG AA), keyboard nav. **HIGH** violations.

## Output Format

```markdown
## UI Review: {scope}

### VIOLATIONS (must fix)
- [CRITICAL] {file}:{line} — Hardcoded color `bg-red-500` → use `bg-error-500`
- [HIGH] {file}:{line} — Inline hex `#3b82f6` → use `CHART_COLORS.primary`

### MISSING COMPONENTS (should fix)
- [MEDIUM] {file}:{line} — Raw `<select>` → use `<Select>` component

### SEMANTIC ISSUES (review)
- [HIGH] {file}:{line} — Error state uses `text-blue-600` → use `text-error-600`

### ACCESSIBILITY
- [HIGH] {file}:{line} — No focus state on interactive element

### SUMMARY
- Violations: {count} (CRITICAL: {n}, HIGH: {n}, MEDIUM: {n})
- Design system compliance: {percentage}%
- Status: PASS / FAIL (FAIL if any CRITICAL or >3 HIGH)
```

## Safety Checks

- NEVER approve UI with CRITICAL color violations (hardcoded Tailwind colors)
- ALWAYS check both design token compliance and accessibility
- NEVER skip accessibility review for interactive components

## Related Files

| File | Purpose |
|------|---------|
| `.claude/refs/design-tokens.md` | Token reference with hex values |
| `.claude/refs/component-registry.md` | Component catalog |
| `rules/frontend-design.md` | Design system policy + Tailwind patterns |
| `.claude/refs/vercel-composition-patterns.md` | React composition patterns (on-demand) |
| `.claude/refs/vercel-react-best-practices.md` | React optimization rules (on-demand) |
| `.claude/refs/web-design-guidelines.md` | Accessibility + forms + typography (on-demand) |
