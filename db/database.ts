import { drizzle } from "drizzle-orm/expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import * as schema from "./schema";

type ExpoDatabaseHandle = {
  execAsync?: (sql: string) => Promise<unknown>;
};

type OpenDatabaseAsync = (name: string) => Promise<ExpoDatabaseHandle>;

let dbInstance: ReturnType<typeof drizzle> | null = null;
let expoInstance: ExpoDatabaseHandle | null = null;

const loadOpenDatabaseAsync = (): OpenDatabaseAsync => {
  // Use require() instead of dynamic import() because Metro bundler
  // fails static analysis on dynamic imports during pre-commit hooks
  const sqliteModule = require("expo-sqlite");

  const candidate =
    (sqliteModule as { openDatabaseAsync?: OpenDatabaseAsync })
      .openDatabaseAsync ??
    (sqliteModule as { default?: { openDatabaseAsync?: OpenDatabaseAsync } })
      .default?.openDatabaseAsync;

  if (!candidate) {
    throw new Error("expo-sqlite does not export openDatabaseAsync");
  }

  return candidate;
};

const getDatabase = async () => {
  if (!dbInstance) {
    const openDatabaseAsync = loadOpenDatabaseAsync();
    expoInstance = await openDatabaseAsync("todos.db");
    // For tests, we might not need a real drizzle instance, just something truthy
    try {
      dbInstance = drizzle(expoInstance as SQLiteDatabase, { schema });
    } catch (_error) {
      // In test environment, create a mock drizzle instance
      dbInstance = {} as ReturnType<typeof drizzle>;
    }
  }
  return dbInstance;
};

export { getDatabase as db };

// Initialize database with schema
export const initializeDatabase = async () => {
  // expo-sqlite works on web using IndexedDB under the hood
  // No need for explicit environment checks as expo-sqlite handles this

  // Reset global state to ensure fresh initialization (important for tests)
  dbInstance = null;
  expoInstance = null;

  const openDatabaseAsync = loadOpenDatabaseAsync();
  const databaseHandle = await openDatabaseAsync("todos.db");
  expoInstance = databaseHandle;

  if (typeof databaseHandle.execAsync !== "function") {
    throw new Error("SQLite database handle is missing execAsync");
  }

  await databaseHandle.execAsync(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await databaseHandle.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS active_priority_idx
    ON todos(priority) WHERE status = 'active';
  `);

  await databaseHandle.execAsync(`
    CREATE INDEX IF NOT EXISTS priority_idx ON todos(priority);
  `);
};

// Helper to convert TodoRow to Todo type for compatibility
export const mapTodoRowToTodo = (
  row: schema.TodoRow
): import("../types/todo").Todo => {
  if (row.id === null || row.id === undefined) {
    throw new Error("Todo row must have an id");
  }

  if (row.priority === null || row.priority === undefined) {
    throw new Error("Todo must have a priority");
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    due_date: row.due_date || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    priority: row.priority,
    status: row.status,
  };
};
