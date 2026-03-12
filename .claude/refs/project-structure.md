# Project Structure

```text
src/
├── server/
│   ├── index.ts                   # Server entry point (migration + health check)
│   ├── shutdown.ts                # Graceful shutdown handler
│   ├── routes/
│   │   └── items.ts               # Items REST API routes
│   ├── database/
│   │   ├── setup.ts               # Drizzle + PostgreSQL connection
│   │   ├── schema.ts              # Drizzle table schemas
│   │   └── repositories.ts       # Typed repository classes
│   └── middleware/
│       └── logger.ts              # Request logging middleware
├── client/
│   ├── index.html
│   ├── test-setup.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/ui/         # Shared UI (Alert, Badge, Button, Card, etc.)
│       ├── features/
│       │   ├── dashboard/         # Dashboard, ItemList, MetricCard
│       │   └── settings/          # SettingsView
│       ├── hooks/
│       │   └── use-items.ts       # Items API hook
│       └── lib/
│           ├── api.ts             # Fetch wrapper
│           ├── design-tokens.ts   # Design token constants
│           └── utils.ts           # Utility functions (cn, etc.)
└── shared/types.ts                # Shared TypeScript types

drizzle/                           # Generated migration files
docker/                            # Dockerfile, Dockerfile.dev
tests/
├── integration/
│   └── repositories.test.ts
└── unit/
    └── logger.test.ts
```

> Update this file when adding/removing files or directories in `src/`.
