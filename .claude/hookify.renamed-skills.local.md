---
name: renamed-skills
enabled: true
event: file
conditions:
  - field: new_text
    operator: regex_match
    pattern: (api-conventions|component-patterns|db-patterns|review-ui|improve-coverage|create-pdca|improve-config|improve-code|improve-template)
---

**Renamed skill reference detected!**

The following skill names have been changed. Use the new names:

| Old Name | New Name |
|----------|----------|
| `api-conventions` | `guide-api` |
| `component-patterns` | `guide-components` |
| `db-patterns` | `guide-database` |
| `review-ui` | `ui-review` |
| `improve-coverage` | `coverage-improvement` |
| `create-pdca` | `pdca-plan` |
| `improve-config` | `improve-infra` |
| `improve-code` | `improve-features` |
| `improve-template` | deleted (split into `improve-architecture` + `improve-features`) |
