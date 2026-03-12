# Money Bus v3

Personal asset management web app. Hono + React 19 + PostgreSQL (Drizzle ORM).

## Language Convention

- **UI text**: Korean (한글) — all user-facing labels, placeholders, headings, messages
- **Documentation**: English — PRDs, PDCA plans, ADRs, guides, code comments, commit messages

## Reference Index

Detailed information is split into individual files under `.claude/refs/`.
Read only the file you need — do NOT read all files at once.

| Need | Read |
| ---- | ---- |
| Source directory tree | `.claude/refs/project-structure.md` |
| Tech stack, dev/prod commands | `.claude/refs/tech-stack.md` |
| Agent list + purposes | `.claude/refs/agents-catalog.md` |
| Skill list + invocations | `.claude/refs/skills-catalog.md` |
| Hook + Hookify rules | `.claude/refs/hooks-catalog.md` |
| Design tokens (colors, spacing) | `.claude/refs/design-tokens.md` |
| Component registry | `.claude/refs/component-registry.md` |
| React/Hook/API code examples | `.claude/refs/frontend-patterns-examples.md` |
| Hono route/repository examples | `.claude/refs/hono-patterns-examples.md` |
| PRD comment formats + examples | `.claude/refs/prd-comment-examples.md` |
| Vercel composition patterns | `.claude/refs/vercel-composition-patterns.md` |
| Vercel React best practices | `.claude/refs/vercel-react-best-practices.md` |
| Web design guidelines | `.claude/refs/web-design-guidelines.md` |

## Refs Freshness

Refs are living documents — update them when source of truth changes.
See `.claude/rules/refs-freshness.md` for the full ref ↔ source mapping and update triggers.
Key rule: update refs at the END of a feature branch (not on every edit).

## PRD-FIRST POLICY

All code changes require PRD → PDCA → Branch → Code order.
See `.claude/rules/prd-pdca-policy.md` for the full policy.
