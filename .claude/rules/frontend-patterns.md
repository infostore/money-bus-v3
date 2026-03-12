---
name: frontend-patterns
description: React 19, TypeScript, and Vite patterns for component architecture, hooks, state management, and API integration.
---

# Frontend Development Patterns

## React Component Patterns

### Functional Components with TypeScript

```typescript
// Component with explicit props interface
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onEdit: (id: string) => void;
  className?: string;
}

export function UserCard({ user, onEdit, className = '' }: UserCardProps) {
  return (
    <div className={`user-card ${className}`}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onEdit(user.id)}>Edit</button>
    </div>
  );
}
```

### Children Pattern

```typescript
interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-content">{children}</div>
    </div>
  );
}

// Usage
<Card title="User Info">
  <UserCard user={user} onEdit={handleEdit} />
</Card>
```

## Custom Hooks Patterns

### API Data Fetching Hook

```typescript
import { useState, useEffect } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [url, trigger]);

  const refetch = () => setTrigger(prev => prev + 1);

  return { data, loading, error, refetch };
}

// Usage
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error } = useApi<User>(`/api/users/${userId}`);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;

  return <UserCard user={user} />;
}
```

### Form Hook

```typescript
import { useState, ChangeEvent, FormEvent } from 'react';

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name as keyof T]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (onSubmit: (values: T) => void | Promise<void>) => {
    return async (e: FormEvent) => {
      e.preventDefault();
      await onSubmit(values);
    };
  };

  const reset = () => setValues(initialValues);

  return { values, errors, setErrors, handleChange, handleSubmit, reset };
}

// Usage
function LoginForm() {
  const { values, errors, setErrors, handleChange, handleSubmit } = useForm({
    email: '',
    password: ''
  });

  const onSubmit = async (data: typeof values) => {
    try {
      await loginApi(data);
    } catch (err) {
      setErrors({ email: 'Invalid credentials' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input name="email" value={values.email} onChange={handleChange} />
      {errors.email && <span>{errors.email}</span>}
      <input name="password" type="password" value={values.password} onChange={handleChange} />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Debounce Hook

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage: Search with debounce
function SearchBar() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      // API call only after user stops typing
      searchApi(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

## Props Interface Design

### Explicit vs Flexible Props

```typescript
// GOOD: Explicit props
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

// GOOD: Extending HTML attributes
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <div>
      <label>{label}</label>
      <input {...props} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

## Folder Structure (Feature-Based)

```
frontend/src/
├── components/          # Shared components
│   ├── ui/             # Basic UI components (Button, Input, Card)
│   └── layout/         # Layout components (Header, Footer, Sidebar)
├── features/           # Feature-specific code
│   ├── auth/
│   │   ├── components/ # Auth-specific components
│   │   ├── hooks/      # useAuth, useLogin
│   │   └── types.ts    # Auth types
│   └── users/
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── hooks/              # Shared hooks
├── lib/                # Utilities
├── types/              # Shared types
└── App.tsx
```

## API Integration Pattern

### Type-Safe API Client

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

// lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  users: {
    get: (id: string) => apiRequest<User>(`/api/users/${id}`),
    list: () => apiRequest<User[]>('/api/users'),
    create: (data: Omit<User, 'id'>) =>
      apiRequest<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

// Usage in component
function UserList() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.users.list().then(setUsers);
  }, []);

  return <div>{users.map(u => <UserCard key={u.id} user={u} />)}</div>;
}
```

## Vite Configuration Patterns

### Environment Variables

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@hooks': '/src/hooks',
    },
  },
});
```

```typescript
// Usage in code
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

## Error Boundary Pattern

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

## Performance Patterns

### React.memo for Expensive Components

```typescript
import { memo } from 'react';

interface ExpensiveListProps {
  items: string[];
}

export const ExpensiveList = memo(function ExpensiveList({ items }: ExpensiveListProps) {
  // Only re-renders if items change
  return (
    <ul>
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
});
```

### useMemo and useCallback

```typescript
import { useMemo, useCallback } from 'react';

function DataTable({ data }: { data: Item[] }) {
  // Memoize expensive computation
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Memoize callback to prevent child re-renders
  const handleClick = useCallback((id: string) => {
    console.log('Clicked:', id);
  }, []);

  return (
    <div>
      {sortedData.map(item => (
        <Row key={item.id} item={item} onClick={handleClick} />
      ))}
    </div>
  );
}
```

### Lazy Loading

```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## Common Pitfalls

### ❌ Avoid

```typescript
// Inline object/array in props (causes re-renders)
<Component data={{ name: 'Alice' }} />

// Missing dependency in useEffect
useEffect(() => {
  fetchData(userId);
}, []); // Missing userId dependency

// Mutating state directly
const [items, setItems] = useState([]);
items.push(newItem); // BAD
```

### ✅ Correct

```typescript
// Memoize objects
const data = useMemo(() => ({ name: 'Alice' }), []);
<Component data={data} />

// Include all dependencies
useEffect(() => {
  fetchData(userId);
}, [userId]);

// Immutable state updates
setItems(prev => [...prev, newItem]);
```
