---
name: sync-agents-md
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.claude/(agents|skills|hooks|hookify|rules)
---

`.claude/` components have been modified. Verify that the corresponding refs catalog files are up to date.

**Checklist:**
- [ ] `.claude/refs/agents-catalog.md` ← `.claude/agents/`
- [ ] `.claude/refs/skills-catalog.md` ← `.claude/skills/`
- [ ] `.claude/refs/hooks-catalog.md` ← `.claude/hooks/` + `hookify.*.local.md`

See `.claude/rules/refs-freshness.md` for full mapping policy.
