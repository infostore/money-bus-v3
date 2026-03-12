# Web Design Guidelines

**Source:** [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)

## Overview

UI code quality review guidelines based on Vercel's public Web Interface Guidelines. 17 rule categories covering accessibility, forms, animation, typography, performance, and more.

## Rule Categories

### 1. Accessibility

- `aria-label` required for icon buttons
- `<label>` or `aria-label` for form controls
- Keyboard handlers for interactive elements
- `<button>` for actions, `<a>` for navigation (`<div onClick>` prohibited)
- `alt` attribute required for images
- `aria-hidden="true"` for decorative icons
- Semantic HTML first, ARIA as supplement
- Heading hierarchy `<h1>`-`<h6>` compliance

### 2. Focus States

- `focus-visible:ring-*` or equivalent focus style
- `outline-none` alone prohibited (alternative focus style required)
- Use `:focus-visible` instead of `:focus`

### 3. Forms

- `autocomplete` + `name` attributes
- Correct `type` and `inputmode` for mobile
- `onPaste` + `preventDefault` prohibited (do not block pasting)
- Labels must be clickable (`htmlFor` or wrapping)
- Submit button: active until request starts, then spinner
- Errors: inline display next to field, focus first error

### 4. Animation

- Respect `prefers-reduced-motion`
- Animate only `transform`/`opacity` (GPU acceleration)
- `transition: all` prohibited (explicit property names required)
- Animations must be interruptible

### 5. Typography

- Use proper ellipsis character
- `tabular-nums` for number columns
- `text-wrap: balance`/`text-pretty` for headings

### 6. Content Handling

- `truncate`, `line-clamp-*`, `break-words` for long text
- `min-w-0` on flex children for text truncation
- Empty state handling for empty lists/results

### 7. Performance

- Lists 50+: virtualization (`content-visibility`)
- No layout reads during render
- Batch DOM reads/writes
- `<link rel="preconnect">` for CDN domains

### 8. Navigation & State

- Reflect state in URL (filters, tabs, pagination)
- Deep link support for stateful UI
- Confirm/undo for destructive actions

### 9. Touch & Interaction

- `touch-action: manipulation` (prevent double-tap zoom)
- `overscroll-behavior: contain` on modals/drawers

### 10. Dark Mode & Theming

- `color-scheme: dark` for native UI
- `<meta name="theme-color">` for browser
- Explicit background/color on native `<select>`

### 11. Locale & i18n

- Date/time: `Intl.DateTimeFormat`
- Numbers/currency: `Intl.NumberFormat`

### 12. Anti-patterns (report immediately when found)

- `user-scalable=no` or `maximum-scale=1`
- `onPaste` + `preventDefault`
- `transition: all`
- `outline-none` without `focus-visible` alternative
- `onClick` navigation without `<a>`
- `<div>`/`<span>` + click handlers
- Images without dimensions
- Form inputs without labels
- Icon buttons without `aria-label`
- Hardcoded date/number formats
