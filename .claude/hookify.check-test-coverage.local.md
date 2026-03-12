---
name: check-test-coverage
enabled: true
event: bash
action: warn
pattern: git\s+commit.*-m
---

⚠️ **Test Coverage Check**

Before committing, verify test coverage meets requirements:

**Required:**
- [ ] Unit tests for new functions/components
- [ ] Integration tests for API endpoints
- [ ] Minimum 80% coverage

**Check coverage:**
```bash
npx vitest run --coverage
```

**TDD workflow:**
1. Write test first (RED)
2. Implement to pass (GREEN)
3. Refactor (IMPROVE)
4. Verify coverage

See: .claude/rules/testing.md
