---
paths:
  - 'src/client/**/*.tsx'
  - 'src/client/**/*.ts'
---

# Frontend Design System & Tailwind

## Policy

- MUST use tokens from `tailwind.config.js`: primary, coral, mint, success, error, info, surface
- Note: `info` is a Tailwind color token (info-50..info-900), NOT a Badge variant. Badge variants: default, success, error, warning, outline
- MUST NOT use hardcoded Tailwind colors: red-*, green-*, blue-*, gray-*, slate-*, etc.
- MUST NOT use inline hex except from `CHART_COLORS` in `src/client/src/lib/design-tokens.ts`
- MUST use UI components (`Button`, `Card`, `Input`, `Modal`, `Badge`, `Select`, `Textarea`, `Label`, `EmptyState`, `Spinner`, `Alert`) instead of raw HTML
- Use `cn()` for conditional classes — no string concatenation
- Mobile-first responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- No `@apply` — create React components instead

## Quick Example

```tsx
// DO: use design tokens
<p className="text-success-600">+12.5%</p>
<Card className={cn(stale && 'opacity-60')}>

// DON'T: hardcode Tailwind colors
<p className="text-green-600">+12.5%</p>
<div className="bg-gray-100 border-gray-300">
```

See `.claude/refs/component-registry.md` for full component list.
See `.claude/refs/design-tokens.md` for color/spacing tokens.
