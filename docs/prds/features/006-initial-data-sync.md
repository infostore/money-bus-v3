---
type: prd
prd-id: PRD-FEAT-006
prd-type: feature
title: Initial Data Bidirectional Sync (SQLite ↔ PostgreSQL)
status: approved
implementation-status: not-started
created: 2026-03-13
updated: 2026-03-13
author: jyoh
tags: [prd, data, sync]
---

# Feature: Initial Data Bidirectional Sync

## 1. Overview

Replace hardcoded seed data in repository classes with a bidirectional sync mechanism between a local SQLite file (`data/initial.db`) and the PostgreSQL database. Reference data (institutions, account types, products) is maintained in a portable SQLite file that syncs with PostgreSQL on server startup. Changes in either direction are propagated based on `updated_at` timestamps.

## 2. User Stories

- As a developer, I want reference data stored in a portable SQLite file so that I can update it without code changes.
- As a user, I want changes I make in the app to persist to the initial data file so that they survive fresh deployments.

## 3. Scope

### In Scope
- `data/initial.db` SQLite file with institutions, account_types, products tables
- Bidirectional sync on server startup (SQLite ↔ PostgreSQL)
- Timestamp-based conflict resolution (`updated_at`)
- Remove hardcoded seed arrays and `seed()` methods from repositories
- Docker volume mount for `data/` directory

### Out of Scope
- Runtime sync (only on startup)
- UI for managing initial.db
- Sync for transactional data (accounts, holdings, price_history)
- ScheduledTask seeding (remains as-is — runtime config, not reference data)

## 4. User Stories (Detailed)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | Sync new SQLite records to PG | Given a record in initial.db not in PG, when server starts, then it is inserted into PG |
| 2 | Sync new PG records to SQLite | Given a record in PG not in initial.db, when server starts, then it is inserted into initial.db |
| 3 | Sync updated SQLite records to PG | Given a record in both with SQLite `updated_at` newer, when server starts, then PG is updated |
| 4 | Sync updated PG records to SQLite | Given a record in both with PG `updated_at` newer, when server starts, then SQLite is updated |
| 5 | No data loss on fresh deploy | Given a fresh PG with no data, when server starts with initial.db, then all reference data is loaded |

## 5. Technical Design

### SQLite Schema (`data/initial.db`)

Three tables mirroring PG schema (without `id` as sync key — use `name` as natural key):

```sql
CREATE TABLE institutions (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '증권',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE account_types (
  name TEXT PRIMARY KEY,
  short_code TEXT,
  tax_treatment TEXT NOT NULL DEFAULT '일반',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  name TEXT PRIMARY KEY,
  code TEXT,
  asset_type TEXT NOT NULL DEFAULT '기타',
  currency TEXT NOT NULL DEFAULT 'KRW',
  exchange TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Sync Algorithm

```
For each table (institutions, account_types, products):
  1. Load all rows from SQLite (keyed by name)
  2. Load all rows from PG (keyed by name)
  3. For each name in SQLite not in PG → INSERT into PG
  4. For each name in PG not in SQLite → INSERT into SQLite
  5. For each name in both:
     - Compare updated_at timestamps
     - If SQLite newer → UPDATE PG
     - If PG newer → UPDATE SQLite
     - If equal → skip
```

### Module: `src/server/database/initial-data-loader.ts`

- `syncInitialData(db: Database, sqlitePath: string): Promise<SyncResult>`
- Uses `better-sqlite3` for synchronous SQLite reads/writes
- Returns `SyncResult` with insert/update counts per table and direction

### Integration

- Called in `src/server/index.ts` after migrations, replacing seed blocks
- SQLite path: `data/initial.db` (relative to project root)
- Docker: mount `./data:/app/data` volume

## 6. Implementation Strategy

| Wave | Tasks | Effort |
|------|-------|--------|
| 1 | Create initial.db from v1 app.db + current PG data | Low |
| 2 | Implement sync module with bidirectional logic | Medium |
| 3 | Replace seed calls in index.ts, remove seed methods | Low |
| 4 | Update Docker config, add tests | Low |

## 7. Success Metrics

- [ ] All reference data syncs bidirectionally on startup
- [ ] No hardcoded seed arrays remain in repository code
- [ ] Existing tests pass (222+)
- [ ] Fresh PG + initial.db → all data loaded

## 8. Dependencies

- `better-sqlite3` (new dependency — synchronous SQLite access)

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timestamp drift between SQLite/PG | Wrong sync direction | Use ISO 8601 strings, compare lexicographically |
| Large initial.db slowing startup | Slow server start | Batch inserts in transactions |
| Binary file in git | Merge conflicts | initial.db is append-mostly; regenerate from script if conflicts |

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-13 | 1.0 | jyoh | Initial PRD |
