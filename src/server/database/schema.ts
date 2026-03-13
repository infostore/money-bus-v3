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

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  value: real('value').notNull().default(0),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const familyMembers = pgTable('family_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  relationship: text('relationship').notNull().default('본인'),
  birthYear: integer('birth_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  category: text('category').notNull().default('증권'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// PRD-FEAT-004: Product Management
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code'),
  assetType: text('asset_type').notNull().default('기타'),
  currency: text('currency').notNull().default('KRW'),
  exchange: text('exchange'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// PRD-FEAT-005: Price History Scheduler
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  open: numeric('open', { precision: 18, scale: 4 }),
  high: numeric('high', { precision: 18, scale: 4 }),
  low: numeric('low', { precision: 18, scale: 4 }),
  close: numeric('close', { precision: 18, scale: 4 }).notNull(),
  volume: bigint('volume', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('price_history_product_date_uniq').on(t.productId, t.date),
])

// PRD-FEAT-005: Scheduled Tasks
export const scheduledTasks = pgTable('scheduled_tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// PRD-FEAT-005: Task Executions
export const taskExecutions = pgTable('task_executions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => scheduledTasks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'),
  productsTotal: integer('products_total').notNull().default(0),
  productsSucceeded: integer('products_succeeded').notNull().default(0),
  productsFailed: integer('products_failed').notNull().default(0),
  productsSkipped: integer('products_skipped').notNull().default(0),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accountTypes = pgTable('account_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  shortCode: text('short_code'),
  taxTreatment: text('tax_treatment').notNull().default('일반'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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

// PRD-FEAT-010: Account Management
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  accountName: text('account_name').notNull().unique(),
  accountNumber: text('account_number'),
  familyMemberId: integer('family_member_id')
    .notNull()
    .references(() => familyMembers.id, { onDelete: 'restrict' }),
  institutionId: integer('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'restrict' }),
  accountTypeId: integer('account_type_id')
    .notNull()
    .references(() => accountTypes.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
