---
name: warn-console-log
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.(ts|tsx|js|jsx)$
  - field: new_text
    operator: regex_match
    pattern: console\.(log|debug|info|warn|error)\(
---

🐛 **Debug Code Detected**

console.log() statements found in code.

**Before committing:**
- Remove debug console statements
- Use `process.stdout.write()` if output is needed (server-side)

**Production code should use:**
- Server-side: `process.stdout.write()` (CLAUDE.md rule)
- Client-side: Remove debug logs before committing

See: CLAUDE.md — "No `console.log` — use `process.stdout.write()`"
