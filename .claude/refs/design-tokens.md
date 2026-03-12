# Design Tokens Reference

> **Source**: `tailwind.config.js` (color palettes), `src/client/src/lib/design-tokens.ts` (chart colors)
> **Update trigger**: Color/token changes in source files

Canonical source: `tailwind.config.js`. All UI code MUST use these tokens — never raw Tailwind colors.

## Color Palettes

### primary (Orange — brand accent, CTAs)

| Token | Hex | Usage |
|-------|-----|-------|
| primary-50 | `#fff7ed` | Light highlights |
| primary-500 | `#f97316` | Primary buttons, links |
| primary-600 | `#ea580c` | Hover state |
| primary-900 | `#7c2d12` | Dark text |

### coral (Warm red — decorative accents)

| Token | Hex | Usage |
|-------|-----|-------|
| coral-500 | `#ff6b6b` | Gradient-warm start |

### mint (Green-teal — secondary accents)

| Token | Hex | Usage |
|-------|-----|-------|
| mint-500 | `#34d399` | Gradient-mint start |

### success (Semantic green — positive status)

| Token | Hex | Usage |
|-------|-----|-------|
| success-50 | `#ecfdf5` | Positive backgrounds |
| success-500 | `#10b981` | Positive status text |

### error (Semantic red — destructive actions, negative status)

| Token | Hex | Usage |
|-------|-----|-------|
| error-50 | `#fff1f2` | Error backgrounds |
| error-500 | `#f43f5e` | Error text, buttons |

### info (Semantic blue — informational)

| Token | Hex | Usage |
|-------|-----|-------|
| info-50 | `#eff6ff` | Info backgrounds |
| info-500 | `#3b82f6` | Info text, accents |

### surface (Warm neutrals — backgrounds, borders, text)

| Token | Hex | Usage |
|-------|-----|-------|
| surface-50 | `#fafaf9` | Page background |
| surface-100 | `#f5f5f4` | Card backgrounds |
| surface-200 | `#e7e5e4` | Borders, dividers |
| surface-500 | `#78716c` | Secondary text |
| surface-700 | `#44403c` | Primary text |
| surface-800 | `#292524` | Headings |

## NEVER USE (Hardcoded Tailwind Colors)

| Banned | Replacement |
|--------|-------------|
| `red-*` | `error-*` |
| `green-*` | `success-*` |
| `blue-*` | `info-*` |
| `gray-*`, `slate-*`, `stone-*` | `surface-*` |
| `yellow-*`, `amber-*`, `orange-*` | `primary-*` |

## Shadows

| Token | Description |
|-------|-------------|
| `glow-sm` | Subtle primary glow (buttons) |
| `glow` | Medium primary glow (active elements) |
| `warm-sm` | Subtle warm shadow (small cards) |
| `warm` | Medium warm shadow (cards) |
| `glass` | Glassmorphism effect (cards, containers) |
| `icon-glow-*` | Icon badge glows (mint, primary, success, error, info) |

## Gradients

| Token | Usage |
|-------|-------|
| `gradient-warm` | Primary buttons (CTA) |
| `gradient-mint` | Secondary accents |
| `gradient-sunset` | Decorative highlights |
| `gradient-surface` | Glass overlays |

## Fonts

| Token | Stack |
|-------|-------|
| `sans` | "Plus Jakarta Sans", system-ui, -apple-system, sans-serif |
