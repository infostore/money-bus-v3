# Refs Freshness Policy

Refs (`.claude/refs/*.md`) are cached summaries of project state. They exist so the AI can load concise context without reading many source files.

## When to Update

Update refs at the **END of a feature branch**, not on every edit. Specifically:

- **Before creating a PR**: check if any ref below is stale due to your changes
- **After merging**: if the merge introduced structural changes

## Ref ↔ Source Mapping

| Ref file | Source of truth | Update when... |
|----------|----------------|----------------|
| `project-structure.md` | `src/` directory tree | Files/directories added or removed |
| `tech-stack.md` | `package.json`, Docker configs | Dependencies or commands change |
| `agents-catalog.md` | `.claude/agents/*.md` | Agent added, removed, or modified |
| `skills-catalog.md` | `.claude/skills/*/SKILL.md` | Skill added, removed, or modified |
| `hooks-catalog.md` | `.claude/settings.json`, hook scripts | Hooks added or changed |
| `design-tokens.md` | `tailwind.config.js`, CSS variables | Colors, spacing, fonts change |
| `component-registry.md` | `src/client/src/components/` | UI components added or modified |
| `frontend-patterns-examples.md` | `src/client/src/features/`, hooks | New patterns or hooks established |
| `hono-patterns-examples.md` | `src/server/routes/`, repositories | New route or repository patterns |
| `prd-comment-examples.md` | PRD comment conventions | Comment format changes |
| `vercel-composition-patterns.md` | External reference | Rarely changes |
| `vercel-react-best-practices.md` | External reference | Rarely changes |
| `web-design-guidelines.md` | External reference | Rarely changes |

## How to Update

1. Read the current ref file
2. Read the source of truth
3. Update the ref to reflect current state
4. Keep refs concise — they are summaries, not duplicates
