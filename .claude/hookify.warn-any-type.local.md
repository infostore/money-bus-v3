---
name: warn-any-type
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.(ts|tsx)$
  - field: new_text
    operator: regex_match
    pattern: (:\s*any\b|as\s+any\b|<any>)
---

**`any` Type Detected**

Usage of `any` type found in TypeScript code. This bypasses type safety and is prohibited in this project.

**Instead of `any`, use:**
- `unknown` + type guards for truly unknown values
- A specific type or interface
- Generic type parameters (`<T>`) for flexible but safe typing

**Examples:**
```typescript
// WRONG
function parse(data: any) { ... }
const result = value as any;

// CORRECT
function parse(data: unknown) {
  if (typeof data === 'string') { ... }
}
const result = value as SpecificType;
```

See: CLAUDE.md — "No `any` — use `unknown` + type guards"
