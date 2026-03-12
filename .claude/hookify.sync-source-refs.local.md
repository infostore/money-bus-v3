---
name: sync-source-refs
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^src/(client/src/(components/ui/|features/|hooks/)|server/(routes/|database/|middleware/)|shared/types)
---

Source code structure has changed. Check if the corresponding refs need updating.

**Mapping:**

| Changed path | Ref to check |
|---|---|
| `src/client/src/components/ui/` | `.claude/refs/component-registry.md` |
| `src/client/src/features/` | `.claude/refs/project-structure.md` |
| `src/client/src/hooks/` | `.claude/refs/project-structure.md` |
| `src/server/routes/` | `.claude/refs/project-structure.md` |
| `src/server/database/` | `.claude/refs/project-structure.md` |
| `src/server/middleware/` | `.claude/refs/project-structure.md` |
| `src/shared/types.ts` | `.claude/refs/project-structure.md` |

Only update refs when **adding or removing** files/exports. Minor edits to existing code do not require ref updates.
