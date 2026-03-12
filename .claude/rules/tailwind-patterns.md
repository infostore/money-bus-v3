---
name: tailwind-patterns
description: Tailwind CSS 3.4 utility patterns, component extraction, responsive design, and cn() utility usage.
---

# Tailwind CSS Patterns

## Utility Class Conventions

### Consistent Spacing

```tsx
// GOOD: Consistent spacing scale (4, 8, 12, 16, 24, 32...)
<div className="p-4 mb-8 gap-4">
  <h1 className="text-2xl mb-4">Title</h1>
  <p className="text-base">Content</p>
</div>

// BAD: Inconsistent spacing
<div className="p-3 mb-7 gap-5">
```

### Color Scheme Consistency

```tsx
// GOOD: Use theme colors
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Click me
</button>

// Define custom colors in tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
      },
    },
  },
};

// Usage
<button className="bg-primary hover:bg-primary/90">
```

## Component Extraction Pattern

### When to Extract

Extract repeated utility combinations into components:

```tsx
// BEFORE: Repeated classes
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
  Save
</button>
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
  Submit
</button>

// AFTER: Extracted component
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  const baseClasses = "px-4 py-2 rounded-lg transition";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  };

  return (
    <button 
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
}
```

## cn() Utility (clsx + tailwind-merge)

### Setup

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```tsx
import { cn } from '@/lib/utils';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  variant?: 'default' | 'bordered';
}

export function Card({ className, children, variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-6",
        variant === 'bordered' && "border border-gray-200",
        className
      )}
    >
      {children}
    </div>
  );
}

// Usage: className prop overrides/extends base classes
<Card className="bg-blue-50 shadow-lg">
  Content
</Card>
```

## Responsive Design Patterns

### Mobile-First Approach

```tsx
// GOOD: Mobile-first (default → sm → md → lg → xl)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Responsive text
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Responsive Heading
</h1>

// Responsive padding
<div className="p-4 md:p-8 lg:p-12">
  Content
</div>
```

### Breakpoint Reference

```
sm: 640px   // Small devices (landscape phones)
md: 768px   // Medium devices (tablets)
lg: 1024px  // Large devices (desktops)
xl: 1280px  // Extra large devices
2xl: 1536px // 2X large devices
```

### Hide/Show at Breakpoints

```tsx
// Hide on mobile, show on desktop
<div className="hidden lg:block">
  Desktop sidebar
</div>

// Show on mobile, hide on desktop
<div className="block lg:hidden">
  Mobile menu
</div>
```

## Dark Mode Pattern

### Setup

```javascript
// tailwind.config.js
export default {
  darkMode: 'class', // or 'media'
  // ...
};
```

### Usage

```tsx
// Add dark: prefix for dark mode styles
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <h1 className="text-gray-900 dark:text-gray-100">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Content</p>
</div>

// Toggle dark mode
function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  return (
    <button onClick={() => setDark(!dark)}>
      {dark ? 'Light' : 'Dark'} Mode
    </button>
  );
}
```

## Layout Patterns

### Flexbox Layouts

```tsx
// Horizontal layout with gap
<div className="flex items-center gap-4">
  <Avatar />
  <div>
    <h3 className="font-semibold">Name</h3>
    <p className="text-sm text-gray-600">Email</p>
  </div>
</div>

// Vertical layout
<div className="flex flex-col gap-2">
  <Label />
  <Input />
  <ErrorMessage />
</div>

// Space between
<div className="flex items-center justify-between">
  <h2>Title</h2>
  <button>Action</button>
</div>
```

### Grid Layouts

```tsx
// Auto-fit grid (responsive without breakpoints)
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Fixed columns with responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

## Common Patterns

### Card Component

```tsx
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
  <h3 className="text-lg font-semibold mb-2">Card Title</h3>
  <p className="text-gray-600">Card content</p>
</div>
```

### Input Field

```tsx
<input
  type="text"
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  placeholder="Enter text"
/>
```

### Button Variants

```tsx
// Primary
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition">
  Primary
</button>

// Secondary
<button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
  Secondary
</button>

// Outline
<button className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition">
  Outline
</button>
```

### Loading Spinner

```tsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
```

## Performance Tips

### Avoid Arbitrary Values When Possible

```tsx
// GOOD: Use theme values
<div className="w-64 h-32 p-4">

// AVOID: Arbitrary values (harder to maintain)
<div className="w-[256px] h-[128px] p-[16px]">
```

### Use @apply Sparingly

```css
/* AVOID: Defeats purpose of utility-first */
.btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg;
}

/* BETTER: Create React component instead */
```

## Common Pitfalls

### ❌ Avoid

```tsx
// Conflicting classes (last one wins, unpredictable)
<div className="p-4 p-8">  // Which padding?

// String concatenation (doesn't merge properly)
<div className={"p-4 " + (active ? "bg-blue-500" : "bg-gray-200")}>
```

### ✅ Correct

```tsx
// Use cn() for conditional classes
<div className={cn("p-4", active ? "bg-blue-500" : "bg-gray-200")}>

// Or clsx
<div className={clsx("p-4", { "bg-blue-500": active, "bg-gray-200": !active })}>
```

## Tailwind Config Customization

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      spacing: {
        '128': '32rem',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```
