# Agents (`.claude/agents/`)

| Agent | Model | Purpose | Skills Preload |
|-------|-------|---------|---------------|
| `api-spec-generator` | sonnet | OpenAPI spec generation + Hono/Drizzle type sync | `guide-api` |
| `architect` | sonnet | System architecture design + Mermaid diagrams + ADR integration | `create-adr`, `guide-api`, `guide-database` |
| `architecture-generator` | -- | Architecture documentation generation | -- |
| `build-error-resolver` | haiku | Fix TypeScript, Vite, eslint errors with minimal diffs | `guide-api`, `guide-database`, `guide-components` |
| `code-reviewer` | sonnet | Code quality + patterns + design system — delegates security to security-reviewer | `ui-review`, `guide-api`, `guide-components` |
| `coverage-analyzer` | haiku | Coverage analysis + gap identification + test suggestions | `check-coverage` |
| `e2e-runner` | sonnet | Playwright E2E test generation, execution, artifact capture | `tdd` |
| `planner` | sonnet | Wave-based implementation planning + dependency analysis | `guide-api`, `guide-database`, `guide-components` |
| `prd-comment-enforcer` | haiku | Verify PRD reference comments on all exported code | -- |
| `prd-generator` | sonnet | Writes content for 9 PRD sections | -- |
| `prd-reviewer` | sonnet | 4C Framework + persona simulation based PRD quality review | `review-prd` |
| `refactor-cleaner` | sonnet | Dead code detection + duplication/size violations | `refactor`, `guide-api` |
| `security-reviewer` | sonnet | Security specialist — 8 inspection categories + Grep patterns | `review-security` |
| `tdd-guide` | sonnet | TDD RED-GREEN-REFACTOR + project-specific test patterns | `tdd`, `guide-api`, `guide-database`, `guide-components` |
