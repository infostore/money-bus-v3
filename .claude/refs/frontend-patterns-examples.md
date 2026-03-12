# Frontend Pattern Examples (React)

## Component Pattern

```typescript
interface UserCardProps {
  readonly user: { id: string; name: string }
  readonly onEdit: (id: string) => void
}

export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div onClick={() => onEdit(user.id)}>
      {user.name}
    </div>
  )
}
```

## Custom Hook Pattern (fetch-based)

```typescript
export function useData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetcher()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}
```

## API Client Pattern

```typescript
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}
```

## Feature Page with Filter

```tsx
const PERIOD_OPTIONS = [3, 6, 12] as const

export function AnalyticsPage() {
  const { data, loading, months, setMonths } = useAnalytics(6)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                months === m ? 'bg-primary-500 text-white' : 'bg-surface-100',
              )}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>
      {/* ... */}
    </div>
  )
}
```

## Bar Chart with Status Coloring (Recharts)

```tsx
const STATUS_COLORS: Record<string, string> = {
  normal: CHART_COLORS.success,
  warning: CHART_COLORS.primary,
  danger: CHART_COLORS.error,
}

export function StatusChart({ slices }: { readonly slices: readonly DataSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHTS.md}>
      <BarChart data={slices} layout="vertical">
        <Bar dataKey="current" radius={[0, 3, 3, 0]}>
          {slices.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

## Folder Structure

```text
src/client/src/
├── components/ui/       # Reusable UI (Button, Card, Input)
├── features/            # Feature-specific code
├── hooks/               # Shared hooks (use-items, etc.)
├── lib/                 # Utilities (cn, api)
└── App.tsx
```

## Performance

- React.memo for expensive components
- useMemo/useCallback for stable references
- React.lazy for code splitting
