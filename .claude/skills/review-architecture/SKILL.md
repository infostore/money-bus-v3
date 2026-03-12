---
name: review-architecture
description: Generate architecture documentation with Mermaid diagrams. Use when designing new features, reviewing system design, or onboarding team members.
argument-hint: "[scope]"
context: fork
agent: architect
---

# Architecture

Analyze codebase structure, generate architecture documentation with Mermaid diagrams, and optionally record decisions as ADRs.

## Usage

```
/review-architecture [scope]
```

## Scope

| Scope | What gets analyzed |
|-------|-------------------|
| (none) | Full project architecture |
| `server` | Backend: routes, repositories, services, database |
| `client` | Frontend: components, hooks, state management |
| `{feature-name}` | Specific feature's architecture across stack |
| `data` | Database schema, data flow, repository patterns |

## When to Use

- Understanding existing architecture before implementing a new feature
- Documenting architecture for a completed feature
- Making an architectural decision that needs an ADR

## Process

### 1. Analyze Structure

Read relevant source files to understand:
- Module boundaries and dependencies
- Data flow (request → route → repository → DB → response)
- Component hierarchy (for client scope)
- API surface (endpoints, request/response shapes)

### 2. Generate Diagrams

Select diagram types based on scope:

| Diagram Type | When to Use | Scope |
|-------------|-------------|-------|
| **System overview** | Full project context | (none), `server`, `client` |
| **Data flow** | Understanding request/response paths | `server`, `data`, `{feature}` |
| **Component hierarchy** | React component tree | `client`, `{feature}` |
| **ER diagram** | Database schema relationships | `data`, `server` |
| **Sequence diagram** | Complex multi-step interactions | `{feature}` |

### 3. Write Documentation

Output format:

```markdown
## Architecture: {scope}

### Overview
{1-2 paragraph summary of the architecture}

### Diagrams
{Mermaid diagrams with descriptions}

### Key Patterns
- {Pattern 1}: {where and why it's used}

### Dependencies
- {Module A} → {Module B}: {relationship}
```

### 4. ADR (Optional)

Ask user if any architectural decision needs to be recorded:
- If yes: create ADR using `create-adr` skill
- If no: skip

### 5. Save Output

- Create directory if needed: `mkdir -p docs/architecture/features`
- Save documentation to `docs/architecture/{scope}.md`
- If scope is a feature: `docs/architecture/features/{feature-name}.md`
- If full project: `docs/architecture/overview.md`

## Safety Checks

- NEVER generate diagrams without reading actual source code first
- ALWAYS verify module boundaries by checking import paths
- NEVER save documentation without confirming scope with user

## Agent

- **architect**: Architecture analysis, Mermaid diagram generation, documentation

## Skill

- **create-adr**: ADR creation from template (if architectural decision recorded)
