---
name: refactor
description: Safe refactoring and dead code removal. Use after feature completion to reduce complexity, remove unused code, or consolidate duplications.
argument-hint: "[scope]"
context: fork
agent: refactor-cleaner
---

# Refactor Clean

Identify dead code, reduce duplication, and improve code organization — safely, with test verification.

## Usage

```
/refactor [scope]
```

## Scope

| Scope | What gets analyzed |
|-------|-------------------|
| (none) | Full project scan |
| `src/server/` | Backend code only |
| `src/client/` | Frontend code only |
| `{file-path}` | Specific file or directory |

## When to Use

- After completing a feature, to clean up
- When files exceed size limits (800 lines) or functions exceed 50 lines
- When duplicate patterns emerge across files
- **Not** for adding features — only for improving existing code

## Process

### 1. Identify Dead Code

Scan for unused code using these criteria:

| Category | Detection Method |
|----------|-----------------|
| Unused exports | Grep for `export` declarations, then Grep for imports across project |
| Unused functions | Functions defined but never called (excluding entry points) |
| Unused variables | TypeScript compiler warnings (`npx tsc --noEmit`) |
| Unused imports | Import statements where imported name is not referenced in file |
| Commented-out code | Blocks of `// code` that are not documentation |
| Unused types | Type/interface definitions not referenced anywhere |

**Not dead code** (do not remove): Entry points, route handlers, exported API, test utilities, type re-exports.

### 2. Identify Duplication

- Scan for repeated code blocks (3+ similar lines appearing 2+ times)
- Identify candidates for extraction (shared patterns, common logic)
- Only extract if the pattern is stable and used 3+ times

### 3. Identify Size Violations

- Files > 800 lines → candidates for splitting
- Functions > 50 lines → candidates for decomposition
- Nesting > 4 levels → candidates for early returns or extraction

### 4. Present Findings

Present all findings to user BEFORE making changes:

```markdown
## Refactor Clean: {scope}

### Dead Code
- [REMOVE] {file}:{line} — {symbol}: unused export (0 imports found)
- [REMOVE] {file}:{line} — {symbol}: unused function (0 call sites)

### Duplication
- [EXTRACT] {file1}:{lines} ↔ {file2}:{lines} — {description}
  → Suggested: extract to {target-file}:{function-name}

### Size Violations
- [SPLIT] {file} — {n} lines (limit: 800)
- [DECOMPOSE] {file}:{function} — {n} lines (limit: 50)

### Summary
- Dead code items: {count}
- Duplication items: {count}
- Size violations: {count}
- Estimated lines removed: {count}
```

### 5. USER CHECKPOINT

WAIT for user approval. User may select which items to fix.

### 6. Execute Changes

- Apply approved changes one at a time
- After each change: `npx vitest run` to verify no regressions
- After all changes: `npx vitest run --coverage` to verify coverage maintained

### 7. Final Verification

Use `SP:verification-before-completion` — run commands and confirm actual output before reporting success:

```bash
npx tsc --noEmit        # No type errors introduced
npx vitest run          # All tests still pass
```

## Superpowers Integration

```
refactor (project workflow: detect → present → approve → execute)
       │
       └→ superpowers:verification-before-completion (evidence-based final check in Step 7)
```

## Safety Checks

- NEVER apply changes without user approval at the checkpoint
- ALWAYS run tests after each individual change — revert if tests break
- NEVER remove code that appears unused without verifying across the entire codebase
- NEVER change behavior — refactoring must keep all tests green

## Agent

- **refactor-cleaner**: Safe refactoring specialist (dead code detection, duplication analysis)
