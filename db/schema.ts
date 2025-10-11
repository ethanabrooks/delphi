import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import type { Priority } from '../types/todo';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
  priority: integer('priority').$type<Priority>().default(1).notNull(),
  category: text('category'),
  due_date: text('due_date'), // ISO string format
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;