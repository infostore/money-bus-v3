# ETF Component Collection Scheduler Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend scheduler that collects ETF constituent holdings from 3 fund managers (Samsung Active XLS, TIMEFOLIO HTML, RISE HTML) via adapter pattern, stores snapshots in PostgreSQL, and exposes trigger/stop/status/query APIs — reusing the existing price scheduler infrastructure.

**Architecture:** Adapter pattern isolates each fund manager's data source. `EtfComponentCollectorService` orchestrates chunked collection with abort support, mirroring `PriceCollectorService`. Repositories handle Drizzle ORM CRUD. Hono routes expose manual trigger, stop, status, and component query endpoints. `startSchedulers` is extended with name-based task dispatch.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL, exceljs (XLS parsing), cheerio (HTML parsing), node-cron, Vitest

**PRD:** PRD-FEAT-012

---

## Chunk 1: Foundation (Schema + Types + Dependencies)

### Task 1: Install npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install exceljs and cheerio**

```bash
npm install exceljs cheerio
```

- [ ] **Step 2: Verify TypeScript types resolve**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors from exceljs/cheerio (cheerio ships its own types; exceljs ships its own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add exceljs and cheerio for ETF component parsing (PRD-FEAT-012)"
```

---

### Task 2: Add Drizzle schema tables

**Files:**
- Modify: `src/server/database/schema.ts` (add `index` import, `etfProfiles` table, `etfComponents` table)

**Context:** Look at `priceHistory` table (line 59-71) for the FK + unique constraint pattern. The `products` table (line 47-56) is the FK target.

- [ ] **Step 1: Add `index` to the drizzle-orm import**

In `src/server/database/schema.ts`, add `index` to the import on line 1-13:

```typescript
import {
  pgTable,
  serial,
  text,
  real,
  integer,
  bigint,
  numeric,
  date,
  timestamp,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: Add `etfProfiles` table definition**

Append after `accounts` table (after line 123):

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
export const etfProfiles = pgTable('etf_profiles', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .unique()
    .references(() => products.id, { onDelete: 'cascade' }),
  manager: text('manager').notNull(),
  expenseRatio: numeric('expense_ratio', { precision: 6, scale: 4 }),
  downloadUrl: text('download_url').notNull(),
  downloadType: text('download_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const etfComponents = pgTable('etf_components', {
  id: serial('id').primaryKey(),
  etfProductId: integer('etf_product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  componentSymbol: text('component_symbol').notNull(),
  componentName: text('component_name').notNull(),
  weight: numeric('weight', { precision: 8, scale: 4 }),
  shares: bigint('shares', { mode: 'number' }),
  snapshotDate: date('snapshot_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('etf_components_product_symbol_date_uniq').on(
    t.etfProductId, t.componentSymbol, t.snapshotDate,
  ),
  index('etf_components_product_date_idx').on(
    t.etfProductId, t.snapshotDate,
  ),
])
```

- [ ] **Step 3: Generate Drizzle migration**

```bash
npm run db:generate
```

Expected: New migration file created in `drizzle/` directory.

- [ ] **Step 4: Apply migration**

```bash
npm run db:migrate
```

Expected: Migration applied successfully. Two new tables created.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/database/schema.ts drizzle/
git commit -m "feat(server): add etf_profiles and etf_components schema (PRD-FEAT-012)"
```

---

### Task 3: Add shared types

**Files:**
- Modify: `src/shared/types.ts` (append after line 199)

**Context:** Follow the existing pattern — all properties `readonly`, snake_case matching DB columns, numeric stored as `string | null` by pg driver.

- [ ] **Step 1: Add EtfManager, EtfProfile, EtfComponent, CreateEtfComponentPayload types**

Append to `src/shared/types.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
export type EtfManager = 'samsung-active' | 'timefolio' | 'rise'

export interface EtfProfile {
  readonly id: number
  readonly product_id: number
  readonly manager: EtfManager
  readonly expense_ratio: string | null
  readonly download_url: string
  readonly download_type: 'xls' | 'html'
  readonly created_at: string
  readonly updated_at: string
}

export interface EtfComponent {
  readonly id: number
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null
  readonly shares: number | null
  readonly snapshot_date: string
  readonly created_at: string
}

export interface CreateEtfComponentPayload {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight?: string | null
  readonly shares?: number | null
  readonly snapshot_date: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(shared): add EtfManager, EtfProfile, EtfComponent types (PRD-FEAT-012)"
```

---

## Chunk 2: Repository Layer (TDD)

### Task 4: EtfProfileRepository — RED tests

**Files:**
- Create: `src/server/database/etf-profile-repository.ts`
- Create: `tests/integration/etf-profile-repository.test.ts`

**Context:** Follow the pattern from `scheduled-task-repository.ts` — constructor takes `Database`, methods return mapped domain objects. The `seedProfiles` method uses `INSERT ON CONFLICT DO NOTHING` (like `seedDefault` in `scheduled-task-repository.ts:19-35`). The test database setup uses `TEST_DATABASE_URL` from `tests/integration/test-database.ts`.

- [ ] **Step 1: Write RED integration tests**

Create `tests/integration/etf-profile-repository.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { EtfProfileRepository } from '../../src/server/database/etf-profile-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'
import type { EtfManager } from '../../src/shared/types.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle<typeof schema>>
let repo: EtfProfileRepository

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new EtfProfileRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE etf_profiles RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE etf_components RESTART IDENTITY CASCADE`)
  // Ensure a product exists for FK
  await db.execute(
    sql`INSERT INTO products (id, name, code, asset_type, currency) VALUES (999, 'Test ETF', 'TEST001', 'ETF', 'KRW') ON CONFLICT DO NOTHING`,
  )
})

describe('EtfProfileRepository', () => {
  const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

  describe('seedProfiles', () => {
    it('should insert new profiles for valid entries', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(1)
      expect(all[0].product_id).toBe(999)
      expect(all[0].manager).toBe('samsung-active')
      expect(all[0].download_url).toBe('https://example.com/test.xls')
    })

    it('should skip entries with unknown manager', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'unknown-manager' as EtfManager, expenseRatio: null, downloadUrl: 'https://example.com', downloadType: 'html' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(0)
    })

    it('should skip entries with missing productCode', async () => {
      const seeds = [
        { productCode: 'NONEXISTENT', manager: 'samsung-active' as EtfManager, expenseRatio: null, downloadUrl: 'https://example.com', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(0)
    })

    it('should not duplicate on re-seed (ON CONFLICT DO NOTHING)', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      const products = [{ id: 999, code: 'TEST001' }]

      await repo.seedProfiles(seeds, products, VALID_MANAGERS)
      await repo.seedProfiles(seeds, products, VALID_MANAGERS)

      const all = await repo.findAll()
      expect(all).toHaveLength(1)
    })
  })

  describe('findAll', () => {
    it('should return empty array when no profiles exist', async () => {
      const all = await repo.findAll()
      expect(all).toEqual([])
    })
  })

  describe('findByProductId', () => {
    it('should return undefined when profile not found', async () => {
      const result = await repo.findByProductId(999)
      expect(result).toBeUndefined()
    })

    it('should return profile when found', async () => {
      const seeds = [
        { productCode: 'TEST001', manager: 'samsung-active' as EtfManager, expenseRatio: '0.0015', downloadUrl: 'https://example.com/test.xls', downloadType: 'xls' as const },
      ]
      await repo.seedProfiles(seeds, [{ id: 999, code: 'TEST001' }], VALID_MANAGERS)

      const result = await repo.findByProductId(999)
      expect(result).toBeDefined()
      expect(result!.product_id).toBe(999)
      expect(result!.manager).toBe('samsung-active')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
npx vitest run tests/integration/etf-profile-repository.test.ts
```

Expected: FAIL — `Cannot find module '../../src/server/database/etf-profile-repository.js'`

- [ ] **Step 3: Write minimal EtfProfileRepository implementation**

Create `src/server/database/etf-profile-repository.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { eq, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { etfProfiles } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { EtfProfile, EtfManager } from '../../shared/types.js'
import { log } from '../middleware/logger.js'

type Database = NodePgDatabase<typeof schemaTypes>

export interface EtfProfileSeedEntry {
  readonly productCode: string
  readonly manager: string
  readonly expenseRatio: string | null
  readonly downloadUrl: string
  readonly downloadType: 'xls' | 'html'
}

export class EtfProfileRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<readonly EtfProfile[]> {
    const rows = await this.db
      .select()
      .from(etfProfiles)
      .orderBy(asc(etfProfiles.id))

    return rows.map(toEtfProfile)
  }

  async findByProductId(productId: number): Promise<EtfProfile | undefined> {
    const rows = await this.db
      .select()
      .from(etfProfiles)
      .where(eq(etfProfiles.productId, productId))

    return rows[0] ? toEtfProfile(rows[0]) : undefined
  }

  async seedProfiles(
    seeds: readonly EtfProfileSeedEntry[],
    products: readonly { readonly id: number; readonly code: string | null }[],
    validManagers: readonly EtfManager[],
  ): Promise<void> {
    const productMap = new Map(
      products.filter((p) => p.code !== null).map((p) => [p.code!, p.id]),
    )

    for (const seed of seeds) {
      if (!validManagers.includes(seed.manager as EtfManager)) {
        log('warn', `ETF seed skipped: unknown manager '${seed.manager}' for product code '${seed.productCode}'`)
        continue
      }

      const productId = productMap.get(seed.productCode)
      if (productId === undefined) {
        log('warn', `ETF seed skipped: product code '${seed.productCode}' not found in products table`)
        continue
      }

      await this.db
        .insert(etfProfiles)
        .values({
          productId,
          manager: seed.manager,
          expenseRatio: seed.expenseRatio,
          downloadUrl: seed.downloadUrl,
          downloadType: seed.downloadType,
        })
        .onConflictDoNothing({ target: etfProfiles.productId })
    }
  }
}

function toEtfProfile(
  row: typeof etfProfiles.$inferSelect,
): EtfProfile {
  return {
    id: row.id,
    product_id: row.productId,
    manager: row.manager as EtfManager,
    expense_ratio: row.expenseRatio,
    download_url: row.downloadUrl,
    download_type: row.downloadType as 'xls' | 'html',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npx vitest run tests/integration/etf-profile-repository.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/database/etf-profile-repository.ts tests/integration/etf-profile-repository.test.ts
git commit -m "feat(server): add EtfProfileRepository with seedProfiles (PRD-FEAT-012)"
```

---

### Task 5: EtfComponentRepository — RED tests

**Files:**
- Create: `src/server/database/etf-component-repository.ts`
- Create: `tests/integration/etf-component-repository.test.ts`

**Context:** Follow `price-history-repository.ts` for upsert pattern. The `upsertMany` uses `onConflictDoUpdate` on the unique constraint columns. `findByProductAndDate` sorts by `weight DESC` (PostgreSQL numeric sort). `hasSnapshot` is a simple existence check.

- [ ] **Step 1: Write RED integration tests**

Create `tests/integration/etf-component-repository.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/server/database/schema.js'
import { EtfComponentRepository } from '../../src/server/database/etf-component-repository.js'
import { TEST_DATABASE_URL } from './test-database.js'
import type { CreateEtfComponentPayload } from '../../src/shared/types.js'

let pool: pg.Pool
let db: ReturnType<typeof drizzle<typeof schema>>
let repo: EtfComponentRepository

const PRODUCT_ID = 999

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL })
  db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  repo = new EtfComponentRepository(db)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE etf_components RESTART IDENTITY CASCADE`)
  await db.execute(
    sql`INSERT INTO products (id, name, code, asset_type, currency) VALUES (${PRODUCT_ID}, 'Test ETF', 'TEST001', 'ETF', 'KRW') ON CONFLICT DO NOTHING`,
  )
})

function makePayload(overrides: Partial<CreateEtfComponentPayload> = {}): CreateEtfComponentPayload {
  return {
    etf_product_id: PRODUCT_ID,
    component_symbol: '005930',
    component_name: '삼성전자',
    weight: '25.5000',
    shares: 1000,
    snapshot_date: '2026-03-13',
    ...overrides,
  }
}

describe('EtfComponentRepository', () => {
  describe('upsertMany', () => {
    it('should insert new component rows', async () => {
      const rows = [
        makePayload({ component_symbol: '005930', weight: '25.5000' }),
        makePayload({ component_symbol: '000660', component_name: 'SK하이닉스', weight: '15.3000' }),
      ]

      await repo.upsertMany(rows)

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(2)
    })

    it('should update existing rows on conflict (upsert)', async () => {
      await repo.upsertMany([makePayload({ weight: '20.0000' })])
      await repo.upsertMany([makePayload({ weight: '25.5000' })])

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(1)
      expect(result[0].weight).toBe('25.5000')
    })

    it('should handle empty array gracefully', async () => {
      await repo.upsertMany([])
      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result).toHaveLength(0)
    })
  })

  describe('findByProductAndDate', () => {
    it('should return components sorted by weight DESC (numeric sort)', async () => {
      await repo.upsertMany([
        makePayload({ component_symbol: 'A', weight: '5.0000' }),
        makePayload({ component_symbol: 'B', weight: '25.5000' }),
        makePayload({ component_symbol: 'C', weight: '10.0000' }),
      ])

      const result = await repo.findByProductAndDate(PRODUCT_ID, '2026-03-13')
      expect(result.map((r) => r.component_symbol)).toEqual(['B', 'C', 'A'])
    })

    it('should return empty array when no data for date', async () => {
      const result = await repo.findByProductAndDate(PRODUCT_ID, '2099-01-01')
      expect(result).toEqual([])
    })
  })

  describe('findDatesByProduct', () => {
    it('should return distinct dates sorted DESC', async () => {
      await repo.upsertMany([
        makePayload({ snapshot_date: '2026-03-10' }),
        makePayload({ snapshot_date: '2026-03-13', component_symbol: 'A' }),
        makePayload({ snapshot_date: '2026-03-11', component_symbol: 'B' }),
      ])

      const dates = await repo.findDatesByProduct(PRODUCT_ID)
      expect(dates).toEqual(['2026-03-13', '2026-03-11', '2026-03-10'])
    })

    it('should return empty array when no data', async () => {
      const dates = await repo.findDatesByProduct(PRODUCT_ID)
      expect(dates).toEqual([])
    })
  })

  describe('hasSnapshot', () => {
    it('should return false when no snapshot exists', async () => {
      const result = await repo.hasSnapshot(PRODUCT_ID, '2026-03-13')
      expect(result).toBe(false)
    })

    it('should return true when snapshot exists', async () => {
      await repo.upsertMany([makePayload()])
      const result = await repo.hasSnapshot(PRODUCT_ID, '2026-03-13')
      expect(result).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
npx vitest run tests/integration/etf-component-repository.test.ts
```

Expected: FAIL — `Cannot find module '../../src/server/database/etf-component-repository.js'`

- [ ] **Step 3: Write EtfComponentRepository implementation**

Create `src/server/database/etf-component-repository.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { eq, and, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { etfComponents } from './schema.js'
import type * as schemaTypes from './schema.js'
import type { EtfComponent, CreateEtfComponentPayload } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

export class EtfComponentRepository {
  constructor(private readonly db: Database) {}

  async upsertMany(rows: readonly CreateEtfComponentPayload[]): Promise<void> {
    if (rows.length === 0) return

    await this.db
      .insert(etfComponents)
      .values(
        rows.map((r) => ({
          etfProductId: r.etf_product_id,
          componentSymbol: r.component_symbol,
          componentName: r.component_name,
          weight: r.weight ?? null,
          shares: r.shares ?? null,
          snapshotDate: r.snapshot_date,
        })),
      )
      .onConflictDoUpdate({
        target: [etfComponents.etfProductId, etfComponents.componentSymbol, etfComponents.snapshotDate],
        set: {
          componentName: sql`excluded.component_name`,
          weight: sql`excluded.weight`,
          shares: sql`excluded.shares`,
        },
      })
  }

  async findByProductAndDate(
    productId: number,
    snapshotDate: string,
  ): Promise<readonly EtfComponent[]> {
    const rows = await this.db
      .select()
      .from(etfComponents)
      .where(
        and(
          eq(etfComponents.etfProductId, productId),
          eq(etfComponents.snapshotDate, snapshotDate),
        ),
      )
      .orderBy(desc(etfComponents.weight))

    return rows.map(toEtfComponent)
  }

  async findDatesByProduct(productId: number): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ snapshotDate: etfComponents.snapshotDate })
      .from(etfComponents)
      .where(eq(etfComponents.etfProductId, productId))
      .orderBy(desc(etfComponents.snapshotDate))

    return rows.map((r) => r.snapshotDate)
  }

  async hasSnapshot(productId: number, snapshotDate: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: etfComponents.id })
      .from(etfComponents)
      .where(
        and(
          eq(etfComponents.etfProductId, productId),
          eq(etfComponents.snapshotDate, snapshotDate),
        ),
      )
      .limit(1)

    return rows.length > 0
  }
}

function toEtfComponent(
  row: typeof etfComponents.$inferSelect,
): EtfComponent {
  return {
    id: row.id,
    etf_product_id: row.etfProductId,
    component_symbol: row.componentSymbol,
    component_name: row.componentName,
    weight: row.weight,
    shares: row.shares,
    snapshot_date: row.snapshotDate,
    created_at: row.createdAt.toISOString(),
  }
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npx vitest run tests/integration/etf-component-repository.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/database/etf-component-repository.ts tests/integration/etf-component-repository.test.ts
git commit -m "feat(server): add EtfComponentRepository with upsert and query (PRD-FEAT-012)"
```

---

## Chunk 3: Adapters (TDD)

### Task 6: Adapter interface + SamsungActiveAdapter

**Files:**
- Create: `src/server/scheduler/etf-component-adapter.ts`
- Create: `src/server/scheduler/samsung-active-adapter.ts`
- Create: `tests/fixtures/samsung-active-holdings.xlsx` (generated in test)
- Create: `tests/unit/samsung-active-adapter.test.ts`

**Context:** Follow the pattern from `naver-finance-adapter.ts` — constructor accepts injected fetch function, parser function exported separately for unit testing. Column mapping: `종목코드` → `component_symbol`, `종목명` → `component_name`, `비중(%)` → `weight`, `보유수량` → `shares`.

- [ ] **Step 1: Create adapter interface**

Create `src/server/scheduler/etf-component-adapter.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfProfile } from '../../shared/types.js'

export interface EtfComponentRow {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null
  readonly shares: number | null
  readonly snapshot_date: string
}

export interface EtfComponentAdapter {
  fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]>
}
```

- [ ] **Step 2: Write RED tests for SamsungActiveAdapter**

Create `tests/unit/samsung-active-adapter.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { SamsungActiveAdapter, parseXlsBuffer } from '../../src/server/scheduler/samsung-active-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'
import ExcelJS from 'exceljs'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1,
    product_id: 100,
    manager: 'samsung-active',
    expense_ratio: '0.0015',
    download_url: 'https://example.com/holdings.xls',
    download_type: 'xls',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function createXlsBuffer(rows: Array<[string, string, number, number]>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRow(['종목코드', '종목명', '비중(%)', '보유수량'])
  for (const row of rows) {
    sheet.addRow(row)
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe('parseXlsBuffer', () => {
  it('should parse rows with correct column mapping', async () => {
    const buffer = await createXlsBuffer([
      ['005930', '삼성전자', 25.5, 1000],
      ['000660', 'SK하이닉스', 15.3, 500],
    ])

    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 100,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '25.5000',
      shares: 1000,
      snapshot_date: '2026-03-13',
    })
    expect(result[1].component_symbol).toBe('000660')
  })

  it('should return empty array for empty sheet', async () => {
    const buffer = await createXlsBuffer([])
    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toEqual([])
  })

  it('should handle null weight and shares gracefully', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sheet1')
    sheet.addRow(['종목코드', '종목명', '비중(%)', '보유수량'])
    sheet.addRow(['005930', '삼성전자', null, null])
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await parseXlsBuffer(buffer, 100, '2026-03-13')
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBeNull()
    expect(result[0].shares).toBeNull()
  })
})

describe('SamsungActiveAdapter', () => {
  it('should fetch and parse XLS from download_url', async () => {
    const xlsBuffer = await createXlsBuffer([
      ['005930', '삼성전자', 25.5, 1000],
    ])
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(xlsBuffer.buffer.slice(xlsBuffer.byteOffset, xlsBuffer.byteOffset + xlsBuffer.byteLength)),
    })

    const adapter = new SamsungActiveAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/holdings.xls')
    expect(result).toHaveLength(1)
    expect(result[0].component_symbol).toBe('005930')
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    const adapter = new SamsungActiveAdapter(mockFetch)

    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 404')
  })
})
```

- [ ] **Step 3: Run tests to verify they FAIL**

```bash
npx vitest run tests/unit/samsung-active-adapter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement SamsungActiveAdapter**

Create `src/server/scheduler/samsung-active-adapter.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import ExcelJS from 'exceljs'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const COL_SYMBOL = '종목코드'
const COL_NAME = '종목명'
const COL_WEIGHT = '비중(%)'
const COL_SHARES = '보유수량'

export async function parseXlsBuffer(
  buffer: Buffer,
  productId: number,
  snapshotDate: string,
): Promise<readonly EtfComponentRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount <= 1) return []

  const headerRow = sheet.getRow(1)
  const colMap = new Map<string, number>()
  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value ?? '').trim()
    colMap.set(value, colNumber)
  })

  const symbolCol = colMap.get(COL_SYMBOL)
  const nameCol = colMap.get(COL_NAME)
  const weightCol = colMap.get(COL_WEIGHT)
  const sharesCol = colMap.get(COL_SHARES)

  if (!symbolCol || !nameCol) return []

  const results: EtfComponentRow[] = []

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const symbol = String(row.getCell(symbolCol).value ?? '').trim()
    const name = String(row.getCell(nameCol).value ?? '').trim()

    if (!symbol) continue

    const rawWeight = weightCol ? row.getCell(weightCol).value : null
    const rawShares = sharesCol ? row.getCell(sharesCol).value : null

    const weight = rawWeight != null ? Number(rawWeight).toFixed(4) : null
    const shares = rawShares != null ? Number(rawShares) : null

    results.push({
      etf_product_id: productId,
      component_symbol: symbol,
      component_name: name,
      weight,
      shares: shares != null && !isNaN(shares) ? shares : null,
      snapshot_date: snapshotDate,
    })
  }

  return results
}

export class SamsungActiveAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const response = await this.fetchFn(profile.download_url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return parseXlsBuffer(buffer, profile.product_id, snapshotDate)
  }
}
```

- [ ] **Step 5: Run tests to verify they PASS**

```bash
npx vitest run tests/unit/samsung-active-adapter.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/scheduler/etf-component-adapter.ts src/server/scheduler/samsung-active-adapter.ts tests/unit/samsung-active-adapter.test.ts
git commit -m "feat(server): add EtfComponentAdapter interface and SamsungActiveAdapter (PRD-FEAT-012)"
```

---

### Task 7: TimefolioAdapter

**Files:**
- Create: `src/server/scheduler/timefolio-adapter.ts`
- Create: `tests/unit/timefolio-adapter.test.ts`

**Context:** Uses cheerio to parse HTML tables. Follow the same pattern as SamsungActiveAdapter — inject fetch, export parser function for unit testing.

- [ ] **Step 1: Write RED tests**

Create `tests/unit/timefolio-adapter.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { TimefolioAdapter, parseTimefolioHtml } from '../../src/server/scheduler/timefolio-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 200, manager: 'timefolio',
    expense_ratio: '0.0050', download_url: 'https://example.com/etf',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

const SAMPLE_HTML = `
<html><body>
<table class="holdings">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>수량</th></tr></thead>
  <tbody>
    <tr><td>005930</td><td>삼성전자</td><td>30.50</td><td>2000</td></tr>
    <tr><td>000660</td><td>SK하이닉스</td><td>15.20</td><td>800</td></tr>
  </tbody>
</table>
</body></html>
`

const EMPTY_HTML = `
<html><body>
<table class="holdings">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>수량</th></tr></thead>
  <tbody></tbody>
</table>
</body></html>
`

describe('parseTimefolioHtml', () => {
  it('should parse constituent rows from HTML table', () => {
    const result = parseTimefolioHtml(SAMPLE_HTML, 200, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 200,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '30.5000',
      shares: 2000,
      snapshot_date: '2026-03-13',
    })
  })

  it('should return empty array for empty table body', () => {
    const result = parseTimefolioHtml(EMPTY_HTML, 200, '2026-03-13')
    expect(result).toEqual([])
  })
})

describe('TimefolioAdapter', () => {
  it('should fetch HTML and parse components', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new TimefolioAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/etf')
    expect(result).toHaveLength(2)
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' })
    const adapter = new TimefolioAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 500')
  })
})
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
npx vitest run tests/unit/timefolio-adapter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TimefolioAdapter**

Create `src/server/scheduler/timefolio-adapter.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import * as cheerio from 'cheerio'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

export function parseTimefolioHtml(
  html: string,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const $ = cheerio.load(html)
  const rows: EtfComponentRow[] = []

  $('table.holdings tbody tr').each((_i, el) => {
    const cells = $(el).find('td')
    if (cells.length < 4) return

    const symbol = $(cells[0]).text().trim()
    const name = $(cells[1]).text().trim()
    const rawWeight = $(cells[2]).text().trim()
    const rawShares = $(cells[3]).text().trim()

    if (!symbol) return

    const weightNum = parseFloat(rawWeight)
    const sharesNum = parseInt(rawShares, 10)

    rows.push({
      etf_product_id: productId,
      component_symbol: symbol,
      component_name: name,
      weight: !isNaN(weightNum) ? weightNum.toFixed(4) : null,
      shares: !isNaN(sharesNum) ? sharesNum : null,
      snapshot_date: snapshotDate,
    })
  })

  return rows
}

export class TimefolioAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const response = await this.fetchFn(profile.download_url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const html = await response.text()
    return parseTimefolioHtml(html, profile.product_id, snapshotDate)
  }
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npx vitest run tests/unit/timefolio-adapter.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/scheduler/timefolio-adapter.ts tests/unit/timefolio-adapter.test.ts
git commit -m "feat(server): add TimefolioAdapter for HTML scraping (PRD-FEAT-012)"
```

---

### Task 8: RiseAdapter

**Files:**
- Create: `src/server/scheduler/rise-adapter.ts`
- Create: `tests/unit/rise-adapter.test.ts`

**Context:** Same cheerio pattern as TIMEFOLIO, but with RISE-specific table structure (different CSS selectors or table structure). The RISE table uses a different class name or structure.

- [ ] **Step 1: Write RED tests**

Create `tests/unit/rise-adapter.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi } from 'vitest'
import { RiseAdapter, parseRiseHtml } from '../../src/server/scheduler/rise-adapter.js'
import type { EtfProfile } from '../../src/shared/types.js'

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 300, manager: 'rise',
    expense_ratio: '0.0030', download_url: 'https://example.com/rise-etf',
    download_type: 'html', created_at: '', updated_at: '',
    ...overrides,
  }
}

const SAMPLE_HTML = `
<html><body>
<table class="component-table">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>보유수량</th></tr></thead>
  <tbody>
    <tr><td>005930</td><td>삼성전자</td><td>20.10</td><td>1500</td></tr>
    <tr><td>035420</td><td>NAVER</td><td>10.50</td><td>300</td></tr>
  </tbody>
</table>
</body></html>
`

const EMPTY_HTML = `
<html><body>
<table class="component-table">
  <thead><tr><th>종목코드</th><th>종목명</th><th>비중(%)</th><th>보유수량</th></tr></thead>
  <tbody></tbody>
</table>
</body></html>
`

describe('parseRiseHtml', () => {
  it('should parse RISE table rows', () => {
    const result = parseRiseHtml(SAMPLE_HTML, 300, '2026-03-13')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      etf_product_id: 300,
      component_symbol: '005930',
      component_name: '삼성전자',
      weight: '20.1000',
      shares: 1500,
      snapshot_date: '2026-03-13',
    })
  })

  it('should return empty array for empty table', () => {
    const result = parseRiseHtml(EMPTY_HTML, 300, '2026-03-13')
    expect(result).toEqual([])
  })
})

describe('RiseAdapter', () => {
  it('should fetch and parse RISE HTML', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    })
    const adapter = new RiseAdapter(mockFetch)
    const result = await adapter.fetchComponents(makeProfile(), '2026-03-13')

    expect(result).toHaveLength(2)
  })

  it('should throw on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
    const adapter = new RiseAdapter(mockFetch)
    await expect(adapter.fetchComponents(makeProfile(), '2026-03-13'))
      .rejects.toThrow('HTTP 403')
  })
})
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
npx vitest run tests/unit/rise-adapter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement RiseAdapter**

Create `src/server/scheduler/rise-adapter.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import * as cheerio from 'cheerio'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

export function parseRiseHtml(
  html: string,
  productId: number,
  snapshotDate: string,
): readonly EtfComponentRow[] {
  const $ = cheerio.load(html)
  const rows: EtfComponentRow[] = []

  $('table.component-table tbody tr').each((_i, el) => {
    const cells = $(el).find('td')
    if (cells.length < 4) return

    const symbol = $(cells[0]).text().trim()
    const name = $(cells[1]).text().trim()
    const rawWeight = $(cells[2]).text().trim()
    const rawShares = $(cells[3]).text().trim()

    if (!symbol) return

    const weightNum = parseFloat(rawWeight)
    const sharesNum = parseInt(rawShares, 10)

    rows.push({
      etf_product_id: productId,
      component_symbol: symbol,
      component_name: name,
      weight: !isNaN(weightNum) ? weightNum.toFixed(4) : null,
      shares: !isNaN(sharesNum) ? sharesNum : null,
      snapshot_date: snapshotDate,
    })
  })

  return rows
}

export class RiseAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const response = await this.fetchFn(profile.download_url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const html = await response.text()
    return parseRiseHtml(html, profile.product_id, snapshotDate)
  }
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npx vitest run tests/unit/rise-adapter.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/scheduler/rise-adapter.ts tests/unit/rise-adapter.test.ts
git commit -m "feat(server): add RiseAdapter for RISE HTML scraping (PRD-FEAT-012)"
```

---

## Chunk 4: Collector Service (TDD)

### Task 9: EtfComponentCollectorService

**Files:**
- Create: `src/server/scheduler/etf-component-collector-service.ts`
- Create: `tests/unit/etf-component-collector-service.test.ts`

**Context:** Mirror `price-collector-service.ts` exactly — `isRunning` flag, `AbortController`, `run()`/`abort()`, chunked processing with delay. Key differences: adapter resolved from a `ReadonlyMap<EtfManager, EtfComponentAdapter>`, snapshot existence check before fetch, today-only collection (no date range iteration in Phase 1).

- [ ] **Step 1: Write RED tests**

Create `tests/unit/etf-component-collector-service.test.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EtfComponentCollectorService } from '../../src/server/scheduler/etf-component-collector-service.js'
import type { EtfProfile, EtfManager, TaskExecution } from '../../src/shared/types.js'
import type { EtfComponentRow } from '../../src/server/scheduler/etf-component-adapter.js'

vi.mock('../../src/server/scheduler/with-retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

vi.mock('../../src/server/middleware/logger.js', () => ({
  log: vi.fn(),
}))

function makeProfile(overrides: Partial<EtfProfile> = {}): EtfProfile {
  return {
    id: 1, product_id: 100, manager: 'samsung-active',
    expense_ratio: '0.0015', download_url: 'https://example.com/test.xls',
    download_type: 'xls', created_at: '', updated_at: '',
    ...overrides,
  }
}

function makeExecution(overrides: Partial<TaskExecution> = {}): TaskExecution {
  return {
    id: 1, task_id: 1, started_at: '2026-03-13T00:00:00Z',
    finished_at: null, status: 'running', products_total: 0,
    products_succeeded: 0, products_failed: 0, products_skipped: 0,
    message: null, created_at: '2026-03-13T00:00:00Z',
    ...overrides,
  }
}

function createMocks() {
  const profileRepo = {
    findAll: vi.fn<() => Promise<readonly EtfProfile[]>>().mockResolvedValue([]),
  }
  const componentRepo = {
    hasSnapshot: vi.fn<(pid: number, date: string) => Promise<boolean>>().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
  }
  const taskExecutionRepo = {
    create: vi.fn().mockResolvedValue(makeExecution()),
    complete: vi.fn().mockImplementation(
      (_id: number, result: { status: string }) =>
        Promise.resolve(makeExecution({ status: result.status as TaskExecution['status'] })),
    ),
    trimOldExecutions: vi.fn().mockResolvedValue(0),
    updateProgress: vi.fn().mockResolvedValue(undefined),
  }
  const samsungAdapter = {
    fetchComponents: vi.fn<(p: EtfProfile, d: string) => Promise<readonly EtfComponentRow[]>>().mockResolvedValue([
      { etf_product_id: 100, component_symbol: '005930', component_name: '삼성전자', weight: '25.5000', shares: 1000, snapshot_date: '2026-03-13' },
    ]),
  }
  const timefolioAdapter = {
    fetchComponents: vi.fn().mockResolvedValue([]),
  }
  const riseAdapter = {
    fetchComponents: vi.fn().mockResolvedValue([]),
  }

  const adapters = new Map<EtfManager, typeof samsungAdapter>([
    ['samsung-active', samsungAdapter],
    ['timefolio', timefolioAdapter],
    ['rise', riseAdapter],
  ])

  return { profileRepo, componentRepo, taskExecutionRepo, adapters, samsungAdapter, timefolioAdapter, riseAdapter }
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new EtfComponentCollectorService(
    mocks.profileRepo as never,
    mocks.componentRepo as never,
    mocks.taskExecutionRepo as never,
    mocks.adapters as never,
    1,
  )
}

describe('EtfComponentCollectorService', () => {
  let mocks: ReturnType<typeof createMocks>
  let service: EtfComponentCollectorService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'))
    mocks = createMocks()
    service = createService(mocks)
  })

  describe('run', () => {
    it('should throw if already running', async () => {
      mocks.profileRepo.findAll.mockImplementation(
        () => new Promise(() => {}), // never resolves
      )
      const first = service.run()
      await expect(service.run()).rejects.toThrow('already running')
      service.abort()
      await first.catch(() => {})
    })

    it('should complete with success when all ETFs succeed', async () => {
      mocks.profileRepo.findAll.mockResolvedValue([makeProfile()])

      const result = await service.run()

      expect(result.status).toBe('success')
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalledOnce()
      expect(mocks.componentRepo.upsertMany).toHaveBeenCalledOnce()
    })

    it('should skip ETF when snapshot already exists', async () => {
      mocks.profileRepo.findAll.mockResolvedValue([makeProfile()])
      mocks.componentRepo.hasSnapshot.mockResolvedValue(true)

      const result = await service.run()

      expect(mocks.samsungAdapter.fetchComponents).not.toHaveBeenCalled()
      expect(result.products_skipped).toBe(1) // via complete mock
    })

    it('should isolate per-ETF errors and continue', async () => {
      const profiles = [
        makeProfile({ id: 1, product_id: 100 }),
        makeProfile({ id: 2, product_id: 200, manager: 'timefolio' }),
      ]
      mocks.profileRepo.findAll.mockResolvedValue(profiles)
      mocks.samsungAdapter.fetchComponents.mockRejectedValue(new Error('Network error'))
      mocks.timefolioAdapter.fetchComponents.mockResolvedValue([])

      const result = await service.run()

      // Both ETFs were attempted
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalled()
      expect(mocks.timefolioAdapter.fetchComponents).toHaveBeenCalled()
      expect(result.status).toBe('partial')
    })

    it('should skip ETF with unknown manager', async () => {
      const profiles = [
        makeProfile({ manager: 'unknown-manager' as EtfManager }),
      ]
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      const result = await service.run()

      expect(result.products_skipped).toBe(1) // via complete mock
    })

    it('should process in chunks of 5 with delay between chunks', async () => {
      const profiles = Array.from({ length: 7 }, (_, i) =>
        makeProfile({ id: i + 1, product_id: 100 + i }),
      )
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      const runPromise = service.run()

      // Advance timers to process delays
      await vi.advanceTimersByTimeAsync(1000)

      await runPromise

      // All 7 ETFs were processed
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalledTimes(7)
    })
  })

  describe('abort', () => {
    it('should stop processing after current chunk', async () => {
      const profiles = Array.from({ length: 10 }, (_, i) =>
        makeProfile({ id: i + 1, product_id: 100 + i }),
      )
      mocks.profileRepo.findAll.mockResolvedValue(profiles)

      // Abort after first chunk starts
      let callCount = 0
      mocks.samsungAdapter.fetchComponents.mockImplementation(async () => {
        callCount++
        if (callCount === 3) service.abort()
        return [{ etf_product_id: 100, component_symbol: '005930', component_name: 'Test', weight: '10.0000', shares: 100, snapshot_date: '2026-03-13' }]
      })

      const runPromise = service.run()
      await vi.advanceTimersByTimeAsync(5000)
      const result = await runPromise

      expect(result.status).toBe('aborted')
      expect(mocks.samsungAdapter.fetchComponents).toHaveBeenCalled()
      // Should not have processed all 10
      expect(callCount).toBeLessThan(10)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they FAIL**

```bash
npx vitest run tests/unit/etf-component-collector-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement EtfComponentCollectorService**

Create `src/server/scheduler/etf-component-collector-service.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfProfile, EtfManager, TaskExecution } from '../../shared/types.js'
import type { EtfProfileRepository } from '../database/etf-profile-repository.js'
import type { EtfComponentRepository } from '../database/etf-component-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { EtfComponentAdapter } from './etf-component-adapter.js'
import { withRetry } from './with-retry.js'
import { log } from '../middleware/logger.js'

const ETF_CHUNK_SIZE = 5
const ETF_CHUNK_DELAY_MS = 500

interface CollectionCounters {
  readonly total: number
  readonly succeeded: number
  readonly failed: number
  readonly skipped: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export class EtfComponentCollectorService {
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(
    private readonly profileRepo: EtfProfileRepository,
    private readonly componentRepo: EtfComponentRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly adapters: ReadonlyMap<EtfManager, EtfComponentAdapter>,
    private readonly taskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  abort(): void {
    this.abortController?.abort()
  }

  async run(): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Collection is already running')
    }

    this.abortController = new AbortController()
    this.isRunning = true
    try {
      return await this.executeCollection(this.abortController.signal)
    } finally {
      this.isRunning = false
      this.abortController = null
    }
  }

  private async executeCollection(signal: AbortSignal): Promise<TaskExecution> {
    const execution = await this.taskExecutionRepo.create({
      taskId: this.taskId,
      startedAt: new Date(),
    })

    const profiles = await this.profileRepo.findAll()
    const snapshotDate = formatDateYYYYMMDD(new Date())
    let counters: CollectionCounters = {
      total: profiles.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    }

    await this.updateProgress(execution.id, counters)

    let aborted = false
    for (let i = 0; i < profiles.length; i += ETF_CHUNK_SIZE) {
      if (signal.aborted) {
        aborted = true
        break
      }

      const chunk = profiles.slice(i, i + ETF_CHUNK_SIZE)
      const result = await this.processChunk(execution.id, chunk, snapshotDate, signal, counters)
      counters = result.counters
      aborted = result.aborted

      if (aborted) break

      const isLastChunk = i + ETF_CHUNK_SIZE >= profiles.length
      if (!isLastChunk) {
        await sleep(ETF_CHUNK_DELAY_MS)
      }
    }

    const status = aborted ? 'aborted' : this.determineStatus(counters)
    const message = aborted ? '사용자 요청으로 중지됨' : null
    const completed = await this.taskExecutionRepo.complete(execution.id, {
      status,
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
      message,
    })

    await this.taskExecutionRepo.trimOldExecutions(this.taskId)

    return completed!
  }

  private async processChunk(
    executionId: number,
    profiles: readonly EtfProfile[],
    snapshotDate: string,
    signal: AbortSignal,
    counters: CollectionCounters,
  ): Promise<{ readonly counters: CollectionCounters; readonly aborted: boolean }> {
    let current = counters

    for (const profile of profiles) {
      if (signal.aborted) {
        return { counters: current, aborted: true }
      }

      current = await this.processOneEtf(profile, snapshotDate, current)
      await this.updateProgress(executionId, current)
    }

    return { counters: current, aborted: false }
  }

  private async processOneEtf(
    profile: EtfProfile,
    snapshotDate: string,
    counters: CollectionCounters,
  ): Promise<CollectionCounters> {
    const adapter = this.adapters.get(profile.manager)
    if (!adapter) {
      log('warn', `No adapter for manager '${profile.manager}' (product_id=${profile.product_id})`)
      return { ...counters, skipped: counters.skipped + 1 }
    }

    const exists = await this.componentRepo.hasSnapshot(profile.product_id, snapshotDate)
    if (exists) {
      return { ...counters, skipped: counters.skipped + 1 }
    }

    try {
      const rows = await withRetry(() => adapter.fetchComponents(profile, snapshotDate))

      if (rows.length > 0) {
        await this.componentRepo.upsertMany(rows)
      }

      log('info', `ETF components collected: product_id=${profile.product_id}, rows=${rows.length}`)
      return { ...counters, succeeded: counters.succeeded + 1 }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `ETF component collection failed for product_id=${profile.product_id}: ${msg}`)
      return { ...counters, failed: counters.failed + 1 }
    }
  }

  private async updateProgress(executionId: number, counters: CollectionCounters): Promise<void> {
    await this.taskExecutionRepo.updateProgress(executionId, {
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
    })
  }

  private determineStatus(counters: CollectionCounters): 'success' | 'partial' | 'failed' {
    if (counters.failed === 0) return 'success'
    if (counters.succeeded === 0) return 'failed'
    return 'partial'
  }
}
```

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npx vitest run tests/unit/etf-component-collector-service.test.ts
```

Expected: All 7 tests PASS. If any fail, adjust the `updateProgress` threading.

- [ ] **Step 5: Commit**

```bash
git add src/server/scheduler/etf-component-collector-service.ts tests/unit/etf-component-collector-service.test.ts
git commit -m "feat(server): add EtfComponentCollectorService with chunked collection (PRD-FEAT-012)"
```

---

## Chunk 5: Routes + Integration + Wiring

### Task 10: ETF component query routes

**Files:**
- Create: `src/server/routes/etf-components.ts`

**Context:** Follow `src/server/routes/scheduler.ts` for the Hono route factory pattern. Validates `productId` and `snapshotDate` query params.

- [ ] **Step 1: Create route file**

Create `src/server/routes/etf-components.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { Hono } from 'hono'
import type { EtfComponentRepository } from '../database/etf-component-repository.js'
import type { ApiResponse, EtfComponent } from '../../shared/types.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function createEtfComponentRoutes(componentRepo: EtfComponentRepository): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const productIdStr = c.req.query('productId')
    const snapshotDate = c.req.query('snapshotDate')

    if (!productIdStr || isNaN(Number(productIdStr))) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'productId is required and must be numeric' },
        400,
      )
    }

    if (!snapshotDate) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'snapshotDate is required' },
        400,
      )
    }

    if (!DATE_REGEX.test(snapshotDate)) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'snapshotDate must be YYYY-MM-DD format' },
        400,
      )
    }

    const data = await componentRepo.findByProductAndDate(Number(productIdStr), snapshotDate)
    return c.json<ApiResponse<readonly EtfComponent[]>>({ success: true, data, error: null })
  })

  app.get('/dates', async (c) => {
    const productIdStr = c.req.query('productId')

    if (!productIdStr || isNaN(Number(productIdStr))) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'productId is required and must be numeric' },
        400,
      )
    }

    const dates = await componentRepo.findDatesByProduct(Number(productIdStr))
    return c.json<ApiResponse<readonly string[]>>({ success: true, data: dates, error: null })
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/routes/etf-components.ts
git commit -m "feat(server): add ETF component query routes (PRD-FEAT-012)"
```

---

### Task 11: ETF scheduler routes

**Files:**
- Create: `src/server/routes/etf-component-scheduler.ts`

**Context:** Mirrors `src/server/routes/scheduler.ts` — POST /run, POST /stop, GET /status. Uses the same `createSchedulerRoutes`-style factory.

- [ ] **Step 1: Create route file**

Create `src/server/routes/etf-component-scheduler.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import { Hono } from 'hono'
import type { EtfComponentCollectorService } from '../scheduler/etf-component-collector-service.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { ApiResponse, TaskExecution } from '../../shared/types.js'

export function createEtfSchedulerRoutes(
  service: EtfComponentCollectorService,
  executionRepo: TaskExecutionRepository,
  taskId: number,
): Hono {
  const app = new Hono()

  app.post('/run', async (c) => {
    if (service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'Collection already running' },
        409,
      )
    }

    const runPromise = service.run()
    runPromise.catch(() => { /* errors handled inside service */ })

    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection started' }, error: null },
      202,
    )
  })

  app.post('/stop', async (c) => {
    if (!service.running) {
      return c.json<ApiResponse<null>>(
        { success: false, data: null, error: 'No collection is currently running' },
        409,
      )
    }

    service.abort()
    return c.json<ApiResponse<{ readonly message: string }>>(
      { success: true, data: { message: 'Collection stopping' }, error: null },
    )
  })

  app.get('/status', async (c) => {
    const executions = await executionRepo.findRecentByTaskId(taskId, 10)
    return c.json<ApiResponse<readonly TaskExecution[]>>({
      success: true,
      data: executions,
      error: null,
    })
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/routes/etf-component-scheduler.ts
git commit -m "feat(server): add ETF scheduler routes run/stop/status (PRD-FEAT-012)"
```

---

### Task 12: ETF profile seed config

**Files:**
- Create: `src/server/scheduler/etf-profile-seed.ts`

- [ ] **Step 1: Create seed config file**

Create `src/server/scheduler/etf-profile-seed.ts`:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfManager } from '../../shared/types.js'
import type { EtfProfileSeedEntry } from '../database/etf-profile-repository.js'

export const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

// Placeholder URLs — populate with real URLs in Wave 8 before enabling cron
export const ETF_PROFILE_SEEDS: readonly EtfProfileSeedEntry[] = [
  // Samsung Active: XLS download
  // Real URL pattern: https://www.samsungfund.com/api/v1/etf/{fund_code}/holdings.xls
  // { productCode: 'KODEX200', manager: 'samsung-active', expenseRatio: '0.0015', downloadUrl: 'https://...', downloadType: 'xls' },

  // TIMEFOLIO: HTML scrape
  // Real URL pattern: https://www.timefolio.co.kr/etf/{fund_id}
  // { productCode: 'TIMEFOLIO...', manager: 'timefolio', expenseRatio: '0.0050', downloadUrl: 'https://...', downloadType: 'html' },

  // RISE: HTML scrape
  // Real URL pattern: https://www.koreaninvest.com/etf/{fund_code}/holdings
  // { productCode: 'RISE...', manager: 'rise', expenseRatio: '0.0030', downloadUrl: 'https://...', downloadType: 'html' },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/server/scheduler/etf-profile-seed.ts
git commit -m "feat(server): add ETF profile seed config with placeholder URLs (PRD-FEAT-012)"
```

---

### Task 13: Update startSchedulers + wire server index

**Files:**
- Modify: `src/server/scheduler/index.ts`
- Modify: `src/server/index.ts`

**Context:** The key change to `startSchedulers` is: rename `service` → `priceService`, add `etfService`, replace the unconditional `service.run()` with a name-based dispatch. In `src/server/index.ts`, follow the existing price scheduler wiring pattern (lines 73-105).

- [ ] **Step 1: Update `startSchedulers` in `src/server/scheduler/index.ts`**

Replace the entire file content:

```typescript
// PRD-FEAT-005: Price History Scheduler
// PRD-FEAT-012: ETF Component Collection Scheduler
import { schedule } from 'node-cron'
import type { ScheduledTaskRepository } from '../database/scheduled-task-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { PriceCollectorService } from './price-collector-service.js'
import type { EtfComponentCollectorService } from './etf-component-collector-service.js'
import { log } from '../middleware/logger.js'

export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  priceService: PriceCollectorService,
  etfService: EtfComponentCollectorService | null,
): Promise<void> {
  const recovered = await executionRepo.recoverStaleRuns()
  if (recovered > 0) {
    log('warn', `Recovered ${recovered} stale 'running' execution(s) from prior crash`)
  }

  const tasks = await taskRepo.findEnabled()
  for (const t of tasks) {
    schedule(t.cron_expression, () => {
      if (t.name === 'price-collection-daily') {
        priceService.run().catch((err) =>
          log('error', `Scheduler '${t.name}' error: ${err}`),
        )
      } else if (t.name === 'etf-component-collection-daily' && etfService) {
        etfService.run().catch((err) =>
          log('error', `Scheduler '${t.name}' error: ${err}`),
        )
      } else {
        log('warn', `Unknown scheduled task: ${t.name} — skipping`)
      }
    })
    log('info', `Cron registered: '${t.name}' → ${t.cron_expression}`)
  }
}
```

- [ ] **Step 2: Update `src/server/index.ts` to wire ETF service**

Add imports after line 18:

```typescript
import { EtfProfileRepository } from './database/etf-profile-repository.js'
import { EtfComponentRepository } from './database/etf-component-repository.js'
import { SamsungActiveAdapter } from './scheduler/samsung-active-adapter.js'
import { TimefolioAdapter } from './scheduler/timefolio-adapter.js'
import { RiseAdapter } from './scheduler/rise-adapter.js'
import { EtfComponentCollectorService } from './scheduler/etf-component-collector-service.js'
import { ETF_PROFILE_SEEDS, VALID_MANAGERS } from './scheduler/etf-profile-seed.js'
import { createEtfSchedulerRoutes } from './routes/etf-component-scheduler.js'
import { createEtfComponentRoutes } from './routes/etf-components.js'
import type { EtfManager } from '../shared/types.js'
```

**IMPORTANT wiring order:** The ETF service must be constructed BEFORE `startSchedulers` is called, because `startSchedulers` needs both services. Restructure the existing code so that:

1. The existing `startSchedulers(...)` call at line 101 is **removed** from the price scheduler try block
2. The ETF setup block below is added after the price scheduler try block
3. `startSchedulers(...)` is called ONCE after both services are constructed

After the price scheduler setup block (after line 105), add:

```typescript
// PRD-FEAT-012: ETF Component Collection Scheduler
const etfProfileRepo = new EtfProfileRepository(db)
const etfComponentRepo = new EtfComponentRepository(db)

let etfCollectorService: EtfComponentCollectorService | null = null
let etfSchedulerTaskId = 0
try {
  // Seed ETF profiles from static config
  const allProducts = await productRepo.findAll()
  const productEntries = allProducts.map((p) => ({ id: p.id, code: p.code }))
  await etfProfileRepo.seedProfiles(ETF_PROFILE_SEEDS, productEntries, VALID_MANAGERS)

  // Seed scheduler task row (disabled by default — enable after Wave 8)
  const etfTask = await scheduledTaskRepo.seedDefault({
    name: 'etf-component-collection-daily',
    cronExpression: '0 12 * * *',
    enabled: false,
  })
  etfSchedulerTaskId = etfTask.id

  // Build adapter map
  const adapters = new Map<EtfManager, SamsungActiveAdapter | TimefolioAdapter | RiseAdapter>([
    ['samsung-active', new SamsungActiveAdapter()],
    ['timefolio', new TimefolioAdapter()],
    ['rise', new RiseAdapter()],
  ])

  etfCollectorService = new EtfComponentCollectorService(
    etfProfileRepo,
    etfComponentRepo,
    taskExecutionRepo,
    adapters,
    etfTask.id,
  )

  log('info', 'ETF component scheduler initialized')
} catch (error) {
  log('error', `ETF scheduler setup failed: ${error}`)
}

// Start schedulers AFTER both services are constructed
// (Remove the original startSchedulers call from the price scheduler try block at line 101)
if (collectorService) {
  try {
    await startSchedulers(scheduledTaskRepo, taskExecutionRepo, collectorService, etfCollectorService)
  } catch (error) {
    log('error', `Scheduler startup failed: ${error}`)
  }
}
```

After the price scheduler route registration block (after line 146), add:

```typescript
// PRD-FEAT-012: ETF component routes
app.route('/api/etf-components', createEtfComponentRoutes(etfComponentRepo))

if (etfCollectorService && etfSchedulerTaskId > 0) {
  app.route(
    '/api/scheduler/etf-components',
    createEtfSchedulerRoutes(etfCollectorService, taskExecutionRepo, etfSchedulerTaskId),
  )
} else {
  app.get('/api/scheduler/etf-components/status', (c) =>
    c.json<ApiResponse<readonly never[]>>({ success: true, data: [], error: null }),
  )
  app.post('/api/scheduler/etf-components/run', (c) =>
    c.json<ApiResponse<null>>(
      { success: false, data: null, error: 'ETF 스케줄러가 초기화되지 않았습니다' },
      503,
    ),
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/scheduler/index.ts src/server/index.ts
git commit -m "feat(server): wire ETF scheduler into startSchedulers and server index (PRD-FEAT-012)"
```

---

### Task 14: Run all tests

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests PASS + all new tests PASS. If `startSchedulers` signature change broke existing scheduler tests, update the test mocks to include the new `etfService` parameter as `null`.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Fix any failures and commit**

If there are failures from the `startSchedulers` signature change in existing tests (e.g., `tests/integration/scheduler-routes.test.ts`), update those tests to pass `null` as the `etfService` parameter.

```bash
git add -A
git commit -m "test: fix existing tests for updated startSchedulers signature (PRD-FEAT-012)"
```

---

## File Map

| Path | Action | Responsibility |
|------|--------|---------------|
| `src/server/database/schema.ts` | Modify | Add `index` import, `etfProfiles` + `etfComponents` tables |
| `src/shared/types.ts` | Modify | Add `EtfManager`, `EtfProfile`, `EtfComponent`, `CreateEtfComponentPayload` |
| `src/server/database/etf-profile-repository.ts` | Create | EtfProfileRepository: findAll, findByProductId, seedProfiles |
| `src/server/database/etf-component-repository.ts` | Create | EtfComponentRepository: upsertMany, findByProductAndDate, findDatesByProduct, hasSnapshot |
| `src/server/scheduler/etf-component-adapter.ts` | Create | EtfComponentAdapter interface + EtfComponentRow |
| `src/server/scheduler/samsung-active-adapter.ts` | Create | SamsungActiveAdapter: XLS parse via exceljs |
| `src/server/scheduler/timefolio-adapter.ts` | Create | TimefolioAdapter: HTML parse via cheerio |
| `src/server/scheduler/rise-adapter.ts` | Create | RiseAdapter: HTML parse via cheerio |
| `src/server/scheduler/etf-component-collector-service.ts` | Create | Orchestration: chunks, abort, retry, progress |
| `src/server/scheduler/etf-profile-seed.ts` | Create | ETF_PROFILE_SEEDS config + VALID_MANAGERS |
| `src/server/routes/etf-components.ts` | Create | GET / and GET /dates query routes |
| `src/server/routes/etf-component-scheduler.ts` | Create | POST /run, POST /stop, GET /status |
| `src/server/scheduler/index.ts` | Modify | Rename param, add etfService, name-based dispatch |
| `src/server/index.ts` | Modify | Wire ETF repos, adapters, service, routes |
| `tests/integration/etf-profile-repository.test.ts` | Create | Integration tests for EtfProfileRepository |
| `tests/integration/etf-component-repository.test.ts` | Create | Integration tests for EtfComponentRepository |
| `tests/unit/samsung-active-adapter.test.ts` | Create | Unit tests for SamsungActiveAdapter + parseXlsBuffer |
| `tests/unit/timefolio-adapter.test.ts` | Create | Unit tests for TimefolioAdapter + parseTimefolioHtml |
| `tests/unit/rise-adapter.test.ts` | Create | Unit tests for RiseAdapter + parseRiseHtml |
| `tests/unit/etf-component-collector-service.test.ts` | Create | Unit tests for EtfComponentCollectorService |
