# UI Review Patterns Reference

## 1. Hardcoded Color Scan

Banned Tailwind color utilities regex:

```
(bg|text|border|ring|from|to|via)-(red|green|blue|gray|slate|emerald|yellow|amber|purple|violet|pink|teal|cyan|indigo|zinc|stone|neutral)-\d+
```

Replacement: use design tokens (primary, coral, mint, success, error, surface).

## 2. Hardcoded Hex Scan

Inline hex values regex:

```
#[0-9a-fA-F]{6}
```

**Exceptions**: values matching `CHART_COLORS` in `src/client/src/lib/design-tokens.ts` are allowed.

## 3. Component Usage Mapping

| Raw HTML | Required Component |
| ------------------------------------------------- | ------------------ |
| `<button` (without `Button` import) | `<Button>` |
| `<select` (without `Select` import) | `<Select>` |
| `<textarea` (without `Textarea` import) | `<Textarea>` |
| `<input` (without `Input` import) | `<Input>` |
| `<span className=".*rounded-full.*px-.*text-xs"` | `<Badge>` |

## 4. Semantic Color Mapping

| Data Context | Expected Token |
| ------------------------------ | -------------- |
| Success, positive states | success-* |
| Error, failure, danger | error-* |
| Warnings, pending states | primary-* |
| Neutral, default states | surface-* |
| Informational | info-* |
