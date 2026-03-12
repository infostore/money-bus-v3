---
name: require-prd-comment
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^src/.*\.(ts|tsx|js|jsx)$
  - field: new_text
    operator: regex_match
    pattern: export\s+(default\s+)?(async\s+)?(function|const|class|interface|type|enum)\s+\w+
---

When adding new exported code entities in `src/`, include a PRD reference comment:
`// PRD-FEAT-NNN: [Brief description]`

See `.claude/rules/prd-comment-standard.md` for format details.
