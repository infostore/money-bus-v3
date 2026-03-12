# Money Bus v3

Personal asset management web app. Hono + React 19 + PostgreSQL (Drizzle ORM).

**Methodology:** PRD + PDCA (Plan-Do-Check-Act)

## Language Convention

- **UI text**: Korean (한글) — all user-facing labels, placeholders, headings, messages
- **Documentation**: English — PRDs, PDCA plans, ADRs, guides, code comments, commit messages

## MANDATORY FIRST RESPONSE PROTOCOL

For any complex request (feature addition, refactoring, debugging, etc.), the agent MUST:
1. **Verify Requirements**: Review existing PRDs in `docs/prds/features/` or create one using `000-template.md`.
2. **Implementation Plan**: Create a step-by-step plan in `docs/pdca/` using `template.md`.
3. **Select Tools**: Declare specialized agents to be used.

## DEVELOPMENT WORKFLOW (PDCA)

1. **P (Plan/Design)**:
   - **Requirements**: Manage PRDs in `docs/prds/features/`.
   - **Plan**: Create implementation plans in `docs/pdca/`.
2. **D (Do/Implement)**:
   - Execute tasks atomically.
   - Commit after each step is recommended (if requested by user).
3. **C (Check/Verify)**:
   - Run typecheck (`npx tsc --noEmit`) and tests (`npx vitest run`).
   - Code review via code-reviewer agent.
4. **A (Act/Refine)**:
   - Fix identified issues and optimize.
   - Update PDCA progress log upon completion.

## STRUCTURE

```
.
├── src/
│   ├── client/          # React 19 + Vite + TypeScript + Tailwind
│   ├── server/          # Hono + @hono/node-server
│   └── shared/          # Shared types
├── docs/
│   ├── prds/features/   # PRDs (Template: 000-template.md)
│   ├── pdca/            # PDCA plans (Template: template.md)
│   ├── adrs/            # Architecture Decision Records
│   ├── architecture/    # Architecture docs
│   ├── guides/          # User guides
│   ├── ideas/           # Feature ideas
│   ├── design/          # Design analysis
│   └── plans/           # Design plans
├── drizzle/             # Database migrations
├── docker/              # Dockerfiles
├── tests/               # Test files
├── CLAUDE.md            # Project knowledge base
└── .claude/             # AI config
```

## WHERE TO LOOK

- Requirements: `docs/prds/features/`
- Architecture Decisions: `docs/adrs/`
- Implementation Plans: `docs/pdca/`
- API Routes: `src/server/routes/`
- Database Schema: `src/server/database/schema.ts`
- Frontend Components: `src/client/src/components/`
- Shared Types: `src/shared/types.ts`

## Reference Index

Detailed information is split into individual files under `.claude/refs/`.
Read only the file you need — do NOT read all files at once.

| Need | Read |
| ---- | ---- |
| Source directory tree | `.claude/refs/project-structure.md` |
| Tech stack, dev/prod commands | `.claude/refs/tech-stack.md` |
| Agent list + purposes | `.claude/refs/agents-catalog.md` |
| Skill list + invocations | `.claude/refs/skills-catalog.md` |
| Hook + Hookify rules | `.claude/refs/hooks-catalog.md` |
| Design tokens (colors, spacing) | `.claude/refs/design-tokens.md` |
| Component registry | `.claude/refs/component-registry.md` |
| React/Hook/API code examples | `.claude/refs/frontend-patterns-examples.md` |
| Hono route/repository examples | `.claude/refs/hono-patterns-examples.md` |
| PRD comment formats + examples | `.claude/refs/prd-comment-examples.md` |
| Vercel composition patterns | `.claude/refs/vercel-composition-patterns.md` |
| Vercel React best practices | `.claude/refs/vercel-react-best-practices.md` |
| Web design guidelines | `.claude/refs/web-design-guidelines.md` |

## Refs Freshness

Refs are living documents — update them when source of truth changes.
See `.claude/rules/refs-freshness.md` for the full ref ↔ source mapping and update triggers.
Key rule: update refs at the END of a feature branch (not on every edit).

## PRD-FIRST POLICY

All code changes require PRD → PDCA → Branch → Code order.
See `.claude/rules/prd-pdca-policy.md` for the full policy.

## CONVENTIONS

- **Atomic Commits**: Implement and verify one feature at a time.
- **Spec First**: Define interfaces and data models before writing implementation code.
- **Zero-Tolerance**: Do not ignore type errors or linting issues.
- **Language**: AI reads English (CLAUDE.md, .claude/*), Human reads Korean (UI).

### Git & Collaboration

- **Semantic Commits**: Use `type(scope): message` format.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.
  - Scopes: `client`, `server`, `shared`, `infra`, `docs`, `deps`.
- **PR Template**: All PRs must link to the related PRD in `docs/prds/features/`.

## ANTI-PATTERNS

| DO NOT | Why |
|--------|-----|
| Skip PRD for "small" changes | Every change needs a requirement anchor to prevent drift. |
| Implementation before PLAN | Code without a plan leads to suboptimal architecture and bugs. |
| Bypass Git hooks/checks | Quality gates ensure the project remains stable. |
| Hardcode environment variables | Use `.env` and `process.env` with validation. |
| Use `console.log` in production | Use structured logger (`src/server/middleware/logger.ts`). |
| Mutate objects/state directly | Always use immutable patterns (spread, new objects). |

## COMMANDS

```bash
# Development (Docker)
npm run docker:dev          # Start dev environment
npm run docker:dev:down     # Stop dev environment

# Development (Local)
npm run dev                 # Start server + client

# Production (Docker)
npm run docker:prod         # Build and start production
npm run docker:prod:down    # Stop production

# Database
npm run db:generate         # Generate Drizzle migrations
npm run db:migrate          # Apply migrations

# Quality
npm run typecheck           # TypeScript check
npm run test                # Run tests
npm run lint                # ESLint
```
