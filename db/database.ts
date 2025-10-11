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
  // Check if we're in a supported environment
  if (typeof window !== "undefined" && !window.indexedDB) {
    throw new Error("SQLite not supported in this environment");
  }

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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0 NOT NULL,
      priority INTEGER DEFAULT 1 NOT NULL,
      category TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Database initialized successfully
};

// Helper to convert TodoRow to Todo type for compatibility
export const mapTodoRowToTodo = (
  row: schema.TodoRow
): import("../types/todo").Todo => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  completed: row.completed,
  priority: row.priority,
  category: row.category || undefined,
  due_date: row.due_date || undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});
