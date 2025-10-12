import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { TodoStatus } from "../types/todo";

export const todos = sqliteTable("todos", {
  priority: integer("priority").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<TodoStatus>().default("active").notNull(),
  due_date: text("due_date"), // ISO string format
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export type TodoRow = typeof todos.$inferSelect;
export type NewTodoRow = typeof todos.$inferInsert;
