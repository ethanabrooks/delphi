import { eq } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { TodoStatus } from "../types/todo";

export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    priority: integer("priority").notNull(), // Required for all todos now
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<TodoStatus>().default("active").notNull(),
    due_date: text("due_date"), // ISO string format
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => ({
    // Unique priority constraint only for active todos
    activePriorityIdx: uniqueIndex("active_priority_idx")
      .on(table.priority)
      .where(eq(table.status, "active")),
    // General index for priority ordering
    priorityIdx: index("priority_idx").on(table.priority),
  })
);

export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;
