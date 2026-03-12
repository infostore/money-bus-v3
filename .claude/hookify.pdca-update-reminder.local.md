---
name: pdca-update-reminder
enabled: true
event: bash
action: warn
pattern: git\s+commit
---

⚠️ **PDCA Update Reminder**

Before committing, ensure you've updated the PDCA document:

**Checklist:**
- [ ] Updated current phase status (Plan/Do/Check/Act)
- [ ] Documented completed tasks
- [ ] Recorded any issues or learnings
- [ ] Updated PRD if scope changed

**PDCA location:** docs/pdca/{slug}.md

See: .claude/rules/prd-pdca-policy.md
