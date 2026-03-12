# Component Registry

Living catalog of all UI components. Check here before creating inline UI patterns.

## Components

### Alert

- **Path**: `src/client/src/components/ui/Alert.tsx`
- **Props**: `variant?: 'info' | 'success' | 'warning' | 'error'`, `title?: string`, `children: ReactNode`
- **Usage**: Warning/error/info panels.

### Badge

- **Path**: `src/client/src/components/ui/Badge.tsx`
- **Props**: `variant?: 'default' | 'success' | 'error' | 'warning' | 'outline'`, `children: ReactNode`
- **Usage**: Status labels, category tags.

### Button

- **Path**: `src/client/src/components/ui/Button.tsx`
- **Props**: `variant?: 'primary' | 'secondary' | 'error' | 'ghost'` + all HTML button attributes
- **Usage**: All clickable actions. Never use raw `<button>`.

```tsx
<Button variant="primary" onClick={handleSave}>Save</Button>
<Button variant="ghost" onClick={handleCancel}>Cancel</Button>
```

### Card, CardHeader, CardTitle, CardContent

- **Path**: `src/client/src/components/ui/Card.tsx`
- **Props**: All HTML div attributes (CardTitle: heading attributes)
- **Usage**: Content containers with glassmorphism styling.

```tsx
<Card>
  <CardHeader><CardTitle>Title</CardTitle></CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

### EmptyState

- **Path**: `src/client/src/components/ui/EmptyState.tsx`
- **Props**: `icon?: LucideIcon`, `title: string`, `description?: string`, `action?: ReactNode`
- **Usage**: Empty data placeholders.

### Input

- **Path**: `src/client/src/components/ui/Input.tsx`
- **Props**: All HTML input attributes
- **Usage**: Text inputs, number inputs, date inputs. Never use raw `<input>`.

### Label

- **Path**: `src/client/src/components/ui/Label.tsx`
- **Props**: All HTML label attributes
- **Usage**: Form field labels.

### Modal

- **Path**: `src/client/src/components/ui/Modal.tsx`
- **Props**: `open: boolean`, `onClose: () => void`, `title: string`, `children: ReactNode`, `className?: string`
- **Usage**: All modal dialogs. Supports Escape key and overlay click to close.

### Select

- **Path**: `src/client/src/components/ui/Select.tsx`
- **Props**: All HTML select attributes
- **Usage**: Dropdown selectors. Never use raw `<select>`.

### Spinner

- **Path**: `src/client/src/components/ui/Spinner.tsx`
- **Props**: `size?: 'sm' | 'md' | 'lg'`
- **Usage**: Loading indicators.

### Textarea

- **Path**: `src/client/src/components/ui/Textarea.tsx`
- **Props**: All HTML textarea attributes
- **Usage**: Multi-line text input. Never use raw `<textarea>`.

## Barrel Export

All components are re-exported from `src/client/src/components/ui/index.ts`:

```tsx
import { Alert, Badge, Button, Card, CardHeader, CardTitle, CardContent,
  EmptyState, Input, Label, Modal, Select, Spinner, Textarea } from '../components/ui'
```
