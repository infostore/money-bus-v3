import { pgTable, serial, text, real, timestamp } from 'drizzle-orm/pg-core'

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
