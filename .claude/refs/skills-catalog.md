# Skills (`.claude/skills/`)

## Workflow Skills (user-invocable via `/`)

| Skill | Invocation | Context | Agent | Purpose |
|-------|-----------|---------|-------|---------|
| `build` | `/build` | — | — | Full lifecycle 5-Phase (PRD→PDCA→TDD→Review→Merge) |
| `create-prd` | `/create-prd` | fork | prd-generator | PRD creation + content authoring + automatic review |
| `create-plan` | `/create-plan` | fork | planner | PDCA implementation plan (PRD validation + Wave decomposition) |
| `pdca-plan` | `/pdca-plan` | — | — | PDCA plan creation from template |
| `tdd` | `/tdd` | fork | tdd-guide | TDD RED-GREEN-REFACTOR + project-specific templates |
| `review-code` | `/review-code` | fork | code-reviewer | Integrated review for quality + security + types + coverage |
| `review-architecture` | `/review-architecture` | fork | architect | Architecture documentation + Mermaid diagrams + ADR |
| `check-coverage` | `/check-coverage` | fork | coverage-analyzer | Coverage analysis + gap suggestions (`--fix` to generate tests) |
| `refactor` | `/refactor` | fork | refactor-cleaner | Dead code detection + USER CHECKPOINT + verification |
| `save-session` | `/save-session` | — | — | Session memory save for continuity |
| `fix-issue` | `/fix-issue` | — | — | GitHub issue → analysis → branch → test → fix → PR |
| `analyze-data` | `/analyze-data` | fork | general-purpose | SQLite data analysis + structured reports |
| `improve-architecture` | `/improve-architecture` | — | — | Pattern compliance, structure, docs gaps → PRD → build |
| `improve-features` | `/improve-features` | — | — | Code quality, deps, modernization → PRD → build |
| `improve-infra` | `/improve-infra` | — | — | .claude/ infrastructure improvement with optional research |
| `sync-vision` | `/sync-vision` | — | — | PRD trend analysis → vision document sync |

## Internal Skills (called from other skills/agents)

| Skill | Type | Context | Agent | Purpose |
|-------|------|---------|-------|---------|
| `update-pdca` | generative | — | — | PDCA status transition (4 phases + safety checks) |
| `create-adr` | generative | fork | architect | ADR creation (auto-assigned ADR-XXX numbering) |
| `review-prd` | analytical | fork | prd-reviewer | 4C Framework + persona analysis + severity output |
| `review-security` | analytical | fork | security-reviewer | 8 inspection categories + Grep patterns + severity |
| `ui-review` | analytical | fork | general-purpose | UI design system compliance + accessibility review |
| `validate-docs` | validation | — | — | PRD + PDCA frontmatter schema compliance |
| `coverage-improvement` | iterative | — | — | Push test coverage to 80%+ (RALPH_STATUS tracking) |

## Reference Skills (auto-loaded, not invocable)

| Skill | Purpose |
|-------|---------|
| `guide-api` | Hono API route patterns, response format, error handling |
| `guide-components` | React components, custom hooks, styling, charts |
| `guide-database` | SQLite WAL patterns, repository implementation, migrations |

## Skill Frontmatter Fields

| Field | Values | Purpose |
|-------|--------|---------|
| `context` | `fork` | Runs in forked context (isolated from main conversation) |
| `agent` | agent name | Delegates execution to a specific agent |
| `disable-model-invocation` | `true` | Prevents direct `/skill` invocation (internal only) |
| `argument-hint` | string | Shown in `/skill` autocomplete for expected arguments |
