---
name: docker-patterns
description: Docker and Docker Compose patterns for Hono + React + PostgreSQL with multi-stage builds and dev/prod configs.
---

# Docker Development Patterns

## Architecture

- **App**: Node.js (Hono server + Vite-built React frontend)
- **Database**: PostgreSQL 17 Alpine
- **Dev**: Hot reload via volume mounts + tsx watch
- **Prod**: Multi-stage build, single container serving API + static files

## Commands

```bash
# Development (with hot reload)
npm run docker:dev        # docker compose -f docker-compose.dev.yml up --build
npm run docker:dev:down   # docker compose -f docker-compose.dev.yml down

# Production
npm run docker:prod       # docker compose up --build -d
npm run docker:prod:down  # docker compose down
```

## Multi-Stage Production Build

```dockerfile
# Stage 1: Dependencies (production only)
FROM node:22-alpine AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:22-alpine AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-alpine AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
```

## Development Volumes

```yaml
volumes:
  - ./src:/app/src                        # Source code (hot reload)
  - ./vite.config.ts:/app/vite.config.ts  # Build config
  - ./tsconfig.json:/app/tsconfig.json
  - /app/node_modules                     # Exclude node_modules
```

## PostgreSQL Service

```yaml
postgres:
  image: postgres:17-alpine
  environment:
    - POSTGRES_USER=app
    - POSTGRES_PASSWORD=secret
    - POSTGRES_DB=app
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U app"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Environment Variables

| Variable | Dev | Prod |
|----------|-----|------|
| `DATABASE_URL` | `postgresql://app:secret@postgres:5432/app` | Via `.env` |
| `DB_POOL_MAX` | `5` | `10` |
| `PORT` | `3001` | `3001` |
| `LOG_LEVEL` | `debug` | `info` |
| `POSTGRES_PASSWORD` | `secret` | Required via `.env` |

## Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1
```

## Best Practices

- Use `depends_on` with `condition: service_healthy` for DB readiness
- Use named volumes for PostgreSQL data persistence
- Exclude `node_modules` from dev volume mounts
- Set `restart: unless-stopped` for production services
