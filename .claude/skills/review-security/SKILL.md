---
name: review-security
description: Security review checklist for Hono + React + SQLite apps. Use before commits or during PR reviews.
argument-hint: "[path]"
context: fork
agent: security-reviewer
---

## Workflow

1. **Determine Scope**: If path argument given, review that file/directory. Otherwise, review staged changes (`git diff --cached`) or all modified files (`git diff`).
2. **Run Checks**: Execute each category below. Use Grep with the provided patterns.
3. **Generate Report**: Use output format at bottom. Include file paths and line numbers.

If argument is missing: review all files changed since last commit (use `git diff --name-only`).

## Checks

### 1. SQL Injection (CRITICAL)

Detect string interpolation in SQL queries. All user/runtime values must use `?` parameterized placeholders.

**Detection patterns** (Grep in `src/server/`):

| Pattern | What it catches |
|---------|-----------------|
| `` `SELECT.*\$\{`` | Template literal interpolation in SELECT |
| `` `INSERT.*\$\{`` | Template literal interpolation in INSERT |
| `` `UPDATE.*\$\{`` | Template literal interpolation in UPDATE |
| `` `DELETE.*\$\{`` | Template literal interpolation in DELETE |
| `+ ['"]SELECT` | String concatenation in SQL |
| `+ ['"]WHERE` | String concatenation in WHERE clause |

**Exceptions**: Hardcoded constants, table/column names built from validated allowlists, `placeholders` generated from `ids.map(() => '?')`.

**Verdict**: If interpolated value originates from user input or unvalidated external source → CRITICAL. If from DB/hardcoded → MEDIUM (still prefer parameterization).

### 2. Input Validation (HIGH)

Verify all route handlers validate request body fields before use.

**Detection patterns** (Grep in `src/server/routes/`):

| Pattern | What it catches |
|---------|-----------------|
| `c.req.json<` | JSON body parsing — verify validation follows |
| `c.req.param\(` | Path params — verify `Number()` + `isNaN` guard |
| `c.req.query\(` | Query params — verify type checking |

**Check for each match**: Is the parsed value validated before being passed to a repository method? Required fields must have `typeof` checks or equivalent. Numeric params must have `isNaN` guards.

### 3. Error Response Exposure (HIGH)

Ensure error responses don't leak internal details (stack traces, SQL errors, file paths).

**Detection patterns** (Grep in `src/server/`):

| Pattern | What it catches |
|---------|-----------------|
| `error.message` | Exposing raw error messages to client |
| `error.stack` | Stack trace leakage |
| `throw error` | Unhandled re-throws (OK if Hono catches with generic 500) |

**Safe pattern**: Return `{ success: false, data: null, error: 'User-friendly message' }` — never forward `error.message` directly to client.

### 4. Hardcoded Secrets (CRITICAL)

**Detection patterns** (Grep in `src/`):

| Pattern | What it catches |
|---------|-----------------|
| `(?i)(api_key\|secret\|password\|token)\s*=\s*['"]` | Hardcoded credential assignments |
| `(?i)authorization.*['"]Bearer ` | Hardcoded auth tokens |
| `(?i)https?://.*:.*@` | Credentials in URLs |

**Exceptions**: `.env.example` placeholder values, test fixtures with obviously fake data.

### 5. XSS Prevention (HIGH)

Scan for unsafe HTML rendering in React components.

**Detection patterns** (Grep in `src/client/`):

| Pattern | What it catches |
|---------|-----------------|
| `dangerously` | React raw HTML prop usage |
| `\.innerHTML` | Direct DOM HTML injection |
| `eval\(` | Code execution from strings |

### 6. CORS Configuration (MEDIUM)

**Check**: Does `src/server/index.ts` configure CORS middleware?

- Localhost-only app: absence is acceptable but should be noted.
- If CORS is present: verify `origin` is not `*` in production builds.

### 7. Console Usage in Production (MEDIUM)

**Detection patterns** (Grep in `src/server/` and `src/client/src/`, exclude test files):

| Pattern | What it catches |
|---------|-----------------|
| `console\.(log\|warn\|error\|info\|debug)` | Console usage in production code |

**Exceptions**: Logger utility wrapper, one-time startup messages.

### 8. Dependency Vulnerabilities (MEDIUM)

Run `npm audit` and report findings. Focus on high/critical severity.

## Output Format

```markdown
## Security Review: {scope}

### CRITICAL (must fix)
- [CRITICAL] {file}:{line} — {category}: {description}
  → Fix: {concrete remediation}

### HIGH (should fix)
- [HIGH] {file}:{line} — {category}: {description}
  → Fix: {remediation}

### MEDIUM (consider fixing)
- [MEDIUM] {file}:{line} — {category}: {description}

### PASSED CHECKS
- [OK] SQL Injection: All queries parameterized
- [OK] XSS: No unsafe HTML rendering
- ...

### npm audit
- {severity}: {count} vulnerabilities
- {or "No vulnerabilities found"}

### SUMMARY
- Violations: {count} (CRITICAL: {n}, HIGH: {n}, MEDIUM: {n})
- Status: PASS / FAIL (FAIL if any CRITICAL or >3 HIGH)
```

## Related Files

| File | Purpose |
|------|---------|
| `src/server/routes/` | API route handlers — primary review target |
| `src/server/database/` | Repository layer — SQL query review |
| `src/client/src/` | React frontend — XSS review |
| `src/shared/types.ts` | Shared type definitions |

## Safety Checks

- ALWAYS scan the actual code, not just assume compliance.
- ALWAYS report passed checks too (gives confidence in coverage).
- NEVER approve if any CRITICAL issue exists.

## When to Use

- Before any release or merge to main
- After adding new API routes or modifying request handling
- When adding/updating authentication or authorization logic
- As part of Phase 4 parallel review via `review-code` skill
