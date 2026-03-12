---
name: guide-components
description: React component, custom hook, styling, and chart patterns for frontend development
user-invocable: false
---

# Frontend Component Patterns

## File Structure

```
src/client/src/
├── features/{domain}/         # Feature views (PascalCase.tsx)
├── components/ui/             # Reusable UI primitives
├── hooks/                     # Custom hooks (use-{name}.ts)
├── lib/api/                   # API modules by domain
├── lib/design-tokens.ts       # Colors, shadows, chart tokens
└── lib/utils.ts               # cn() utility (clsx + tailwind-merge)
```

## Props Interface

Always `readonly`, no `I` prefix:

```typescript
interface ThingCardProps {
  readonly title: string
  readonly value: number
  readonly variant?: 'default' | 'mint' | 'danger'
  readonly onClick?: () => void
}

export function ThingCard({ title, value, variant = 'default', onClick }: ThingCardProps) {
  return <div className={cn('glass rounded-2xl p-4', className)}>...</div>
}
```

## Custom Hook Pattern

Return readonly result interface with loading/error/actions:

```typescript
interface UseThingsResult {
  readonly things: Thing[]
  readonly loading: boolean
  readonly error: string | null
  readonly createThing: (input: CreateThingPayload) => Promise<void>
  readonly refresh: () => void
}

export function useThings(): UseThingsResult {
  const [things, setThings] = useState<Thing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refresh = useCallback(() => setTrigger((t) => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.things.list()
      .then(setThings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [trigger])

  const createThing = useCallback(async (input: CreateThingPayload) => {
    await api.things.create(input)
    refresh()
  }, [refresh])

  return { things, loading, error, createThing, refresh }
}
```

## API Client Pattern

Generic `request<T>()` in `lib/api.ts`. Domain APIs as object literals:

```typescript
export const thingsApi = {
  list: () => request<Thing[]>('/things'),
  getById: (id: number) => request<Thing>(`/things/${id}`),
  create: (input: CreateThingPayload) =>
    request<Thing>('/things', { method: 'POST', body: JSON.stringify(input) }),
  delete: (id: number) =>
    request<boolean>(`/things/${id}`, { method: 'DELETE' }),
}
```

Barrel-exported in `lib/api.ts` as `api.things.*`.

## Styling — Warm Glassmorphism

- Glass classes: `glass`, `glass-hover`, `glass-subtle`
- Gradients: `bg-gradient-warm`, `bg-gradient-mint`, `bg-gradient-sunset`
- Shadows: `shadow-glow-sm`, `shadow-glass`, `shadow-icon-glow-primary`
- Use `cn()` for conditional class merging

```typescript
<div className={cn(
  'glass rounded-2xl p-6',
  isActive && 'border-primary-200',
)}>
```

## Charts (Recharts)

Use design tokens from `lib/design-tokens.ts`:

```typescript
import { CHART_COLORS, CHART_COLOR_ARRAY, CHART_TOOLTIP_STYLE, CHART_HEIGHTS } from '../../lib/design-tokens'

<ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
  <BarChart data={data}>
    <XAxis stroke={CHART_COLORS.surface} />
    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
    <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
    {/* For multi-series: use CHART_COLOR_ARRAY[index] */}
  </BarChart>
</ResponsiveContainer>
```

For simple visuals (donut, gauge), use custom SVG instead of Recharts.
