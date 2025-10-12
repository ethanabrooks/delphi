import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let expoInstance: Awaited<ReturnType<typeof openDatabaseAsync>> | null = null;

const getDatabase = async () => {
  if (!dbInstance) {
    expoInstance = await openDatabaseAsync("todos.db");
    dbInstance = drizzle(expoInstance, { schema });
  }
  return dbInstance;
};

export { getDatabase as db };

// Initialize database with schema
export const initializeDatabase = async () => {
  // expo-sqlite works on web using IndexedDB under the hood
  // No need for explicit environment checks as expo-sqlite handles this

  // Ensure we have the expo instance
  if (!expoInstance) {
    await getDatabase();
  }

  // Create the todos table if it doesn't exist
  if (!expoInstance) {
    throw new Error("SQLite database not initialized");
  }

  await expoInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS todos (
      priority INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (priority, status)
    );
  `);

  // Database initialized successfully
};

// Helper to convert TodoRow to Todo type for compatibility
export const mapTodoRowToTodo = (
  row: schema.TodoRow
): import("../types/todo").Todo => ({
  priority: row.priority,
  title: row.title,
  description: row.description || undefined,
  status: row.status,
  due_date: row.due_date || undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});
