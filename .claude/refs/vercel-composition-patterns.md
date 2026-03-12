# Vercel Composition Patterns Analysis

**Source:** Vercel Engineering (January 2026)

## Overview

Guidelines for designing scalable React components using composition patterns. Covers how to avoid boolean prop proliferation and create flexible component APIs using Compound Components and Lift State patterns.

## Core Principles

> **Lift state, compose internals, make state dependency-injectable.**

## Rule Categories (4 categories, 8 rules)

### 1. Component Architecture — HIGH

#### 1.1 Avoid Boolean Prop Proliferation — CRITICAL

Each boolean prop doubles the number of possible states. Create explicit variant components instead.

```tsx
// BAD: Exponential complexity from boolean props
<Composer isThread isDMThread={false} isEditing={false} showAttachments />

// GOOD: Explicit variant components
<ThreadComposer channelId="abc" />
<EditMessageComposer messageId="xyz" />
```

#### 1.2 Use Compound Components — HIGH

Structure complex components as sub-components based on shared Context.

```tsx
// BAD: Combination of render props and booleans
<Composer renderHeader={...} showAttachments showFormatting={false} />

// GOOD: Compound components
<Composer.Frame>
  <Composer.Header />
  <Composer.Input />
  <Composer.Footer>
    <Composer.Attachments />
    <Composer.Submit />
  </Composer.Footer>
</Composer.Frame>
```

### 2. State Management — MEDIUM

#### 2.1 Decouple State Management from UI — MEDIUM

The Provider is the only place that knows the state implementation. UI components only consume the Context interface.

#### 2.2 Define Generic Context Interfaces — HIGH

Define a generic interface: `state`, `actions`, `meta`. All Providers implement this contract.

```typescript
interface ComposerContextValue {
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}
```

#### 2.3 Lift State into Provider Components — HIGH

Move state into a dedicated Provider so sibling components can access it.

```tsx
<FilterProvider>
  <Composer.Frame>...</Composer.Frame>
  <Preview />        {/* Can access state */}
  <SubmitButton />   {/* Can call submit */}
</FilterProvider>
```

### 3. Implementation Patterns — MEDIUM

#### 3.1 Create Explicit Component Variants — MEDIUM

Instead of multiple booleans, create explicit variant components.

#### 3.2 Prefer Children Over Render Props — MEDIUM

```tsx
// BAD: render props
<Composer renderHeader={() => <CustomHeader />} />

// GOOD: children composition
<Composer.Frame>
  <CustomHeader />
  <Composer.Input />
</Composer.Frame>
```

### 4. React 19 APIs — MEDIUM

| Change | Before (React 18) | After (React 19) |
|--------|-------------------|-----------------|
| ref forwarding | `forwardRef((props, ref) => ...)` | `function Comp({ ref, ...props })` |
| Context consumption | `useContext(MyContext)` | `use(MyContext)` (conditional calls allowed) |

## Relationship with Other Skills

| Skill | Perspective |
|-------|-------------|
| **web-design-guidelines** | "How the component looks" (UI/UX quality) |
| **react-best-practices** | "How fast the component is" (performance) |
| **composition-patterns** | "How the component is structured" (architecture) |
