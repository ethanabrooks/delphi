import type {
  CreateTodoInput,
  Todo,
  TodoStatus,
  UpdateTodoInput,
} from "../types/todo";

type PlatformUpdatePayload = UpdateTodoInput & {
  id: number; // Required ID for identification
};

const runtimeHasDom =
  typeof window !== "undefined" && typeof document !== "undefined";

export const isWebPlatform = runtimeHasDom;

const STORAGE_KEY = "delphi_todos";

// biome-ignore lint/complexity/noStaticOnlyClass: platform abstraction is a static shim over localStorage
class WebTodoService {
  /**
   * Bumps priority of active todos at or above the given priority by 1
   * @param excludeTodo Optional todo to exclude from bumping (for updates)
   */
  private static bumpActiveTodosFromPriority(
    todos: Todo[],
    fromPriority: number,
    now: string,
    excludeTodo?: Todo
  ): Todo[] {
    const result = todos.map((todo) => {
      if (
        todo !== excludeTodo &&
        todo.status === "active" &&
        todo.priority >= fromPriority
      ) {
        return { ...todo, priority: todo.priority + 1, updated_at: now };
      }
      return todo;
    });

    return result;
  }

  /**
   * Reorders active todos by swapping priorities until target is reached
   * Much simpler than remove/compact/insert approach
   */
  private static reorderActiveTodos(
    todos: Todo[],
    todoToMove: Todo,
    targetPriority: number,
    now: string
  ): Todo[] {
    const result = [...todos];
    const currentPriority = todoToMove.priority as number;

    // Determine direction and step
    const direction = targetPriority > currentPriority ? 1 : -1;
    const step = direction === 1 ? 1 : -1;

    // Keep swapping until we reach the target
    let movingPriority = currentPriority;
    while (movingPriority !== targetPriority) {
      const nextPriority = movingPriority + step;

      // Find todos at current and next priorities
      const movingTodoIndex = result.findIndex((t) => t.id === todoToMove.id);
      const swapTodoIndex = result.findIndex(
        (t) => t.status === "active" && t.priority === nextPriority
      );

      if (movingTodoIndex === -1) break;
      if (swapTodoIndex === -1) break; // No todo at next priority

      // Swap priorities
      const movingTodo = result[movingTodoIndex];
      const swapTodo = result[swapTodoIndex];

      result[movingTodoIndex] = {
        ...movingTodo,
        priority: nextPriority,
        updated_at: now,
      };
      result[swapTodoIndex] = {
        ...swapTodo,
        priority: movingPriority,
        updated_at: now,
      };

      movingPriority = nextPriority;
    }

    return result;
  }

  /**
   * Finds a todo by ID
   */
  private static findTodoById(todos: Todo[], id: number): Todo | undefined {
    return todos.find((todo) => todo.id === id);
  }

  private static read(): Todo[] {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Todo[]) : [];
    } catch {
      return [];
    }
  }

  private static write(todos: Todo[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // ignore persistence errors in web demo mode
    }
  }

  static async getAllTodos(): Promise<Todo[]> {
    return WebTodoService.read();
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const todos = WebTodoService.read();
    const now = new Date().toISOString();

    // Bump existing todos with the same status and priority >= input.priority
    const bumped = WebTodoService.bumpActiveTodosFromPriority(
      todos,
      input.priority,
      now
    );

    // Generate next autoincrement ID
    const maxId =
      todos.length > 0 ? Math.max(...todos.map((todo) => todo.id)) : 0;
    const nextId = maxId + 1;

    const newTodo: Todo = {
      id: nextId,
      priority: input.priority, // Use the priority from input
      title: input.title,
      description: input.description,
      status: "active",
      due_date: input.due_date,
      created_at: now,
      updated_at: now,
    };

    WebTodoService.write([newTodo, ...bumped]);

    return newTodo;
  }

  static async updateTodo(input: PlatformUpdatePayload): Promise<Todo | null> {
    const todos = WebTodoService.read();
    const now = new Date().toISOString();

    // Find todo by ID
    const currentTodo = WebTodoService.findTodoById(todos, input.id);
    if (!currentTodo) {
      return null;
    }

    const index = todos.findIndex((todo) => todo.id === input.id);
    const newPriority = input.priority ?? currentTodo.priority;
    const newStatus = input.status ?? currentTodo.status;

    // If becoming active with a specific priority, handle insertion/reordering
    if (
      newStatus === "active" &&
      newPriority !== null &&
      (newPriority !== currentTodo.priority || currentTodo.status !== "active")
    ) {
      if (currentTodo.status === "active") {
        // Already active todo - use reordering
        const todoForReordering: Todo = {
          id: currentTodo.id,
          title: input.title ?? currentTodo.title,
          description: input.description ?? currentTodo.description,
          priority: currentTodo.priority,
          status: "active",
          due_date: input.due_date ?? currentTodo.due_date,
          created_at: currentTodo.created_at,
          updated_at: now,
        };

        const reordered = WebTodoService.reorderActiveTodos(
          todos,
          todoForReordering,
          newPriority,
          now
        );

        WebTodoService.write(reordered);
        const finalUpdated = reordered.find((t) => t.id === input.id);
        return finalUpdated || null;
      } else {
        // Reactivating a completed/archived todo - use bump logic
        const updatedTodos = [...todos];

        // Bump existing active todos at/above target priority
        const bumpedTodos = WebTodoService.bumpActiveTodosFromPriority(
          updatedTodos,
          newPriority,
          now
        );
        updatedTodos.splice(0, updatedTodos.length, ...bumpedTodos);

        // Update current todo to active status with new priority
        const index = updatedTodos.findIndex((t) => t.id === input.id);
        if (index >= 0) {
          updatedTodos[index] = {
            id: currentTodo.id,
            title: input.title ?? currentTodo.title,
            description: input.description ?? currentTodo.description,
            priority: newPriority,
            status: "active",
            due_date: input.due_date ?? currentTodo.due_date,
            created_at: currentTodo.created_at,
            updated_at: now,
          };
        }

        WebTodoService.write(updatedTodos);
        return updatedTodos.find((t) => t.id === input.id) || null;
      }
    } else {
      // No priority conflict, simple update
      const updated: Todo = {
        id: currentTodo.id,
        title: input.title ?? currentTodo.title,
        description: input.description ?? currentTodo.description,
        priority: newPriority as number, // Preserve priority for all statuses
        status: newStatus,
        due_date: input.due_date ?? currentTodo.due_date,
        created_at: currentTodo.created_at,
        updated_at: now,
      };

      todos[index] = updated;
      WebTodoService.write(todos);

      return updated;
    }
  }

  static async deleteTodo(id: number): Promise<boolean> {
    const todos = WebTodoService.read();
    const todoToDelete = todos.find((t) => t.id === id);

    if (todoToDelete) {
    }

    const filtered = todos.filter((todo) => todo.id !== id);
    WebTodoService.write(filtered);

    if (todoToDelete) {
    }

    return filtered.length !== todos.length;
  }

  static async toggleCompleted(id: number): Promise<Todo | null> {
    const todos = WebTodoService.read();
    const todo = WebTodoService.findTodoById(todos, id);

    if (!todo) {
      return null;
    }

    // Only allow toggling between active and completed
    if (todo.status !== "active" && todo.status !== "completed") {
      return todo; // Return unchanged
    }

    const newStatus: TodoStatus =
      todo.status === "active" ? "completed" : "active";

    // Create update payload with required ID
    const updateInput: PlatformUpdatePayload = {
      id: todo.id,
      status: newStatus,
    };

    if (newStatus === "active") {
      updateInput.priority = 1; // Insert at top
    }

    return WebTodoService.updateTodo(updateInput);
  }

  static async toggleArchived(id: number): Promise<Todo | null> {
    const todos = WebTodoService.read();
    const todo = WebTodoService.findTodoById(todos, id);

    if (!todo) {
      return null;
    }

    // Only allow toggling between active and archived
    if (todo.status !== "active" && todo.status !== "archived") {
      return todo; // Return unchanged
    }

    const newStatus: TodoStatus =
      todo.status === "active" ? "archived" : "active";

    // Create update payload with required ID
    const updateInput: PlatformUpdatePayload = {
      id: todo.id,
      status: newStatus,
    };

    if (newStatus === "active") {
      updateInput.priority = 1; // Insert at top
    }

    return WebTodoService.updateTodo(updateInput);
  }

  static async clearAllTodos(): Promise<void> {
    WebTodoService.write([]);
  }

  static async getTodoById(id: number): Promise<Todo | null> {
    const todos = WebTodoService.read();
    return WebTodoService.findTodoById(todos, id) || null;
  }

  static async getActiveTodos(): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.status === "active");
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.status === "completed");
  }

  static async getArchivedTodos(): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.status === "archived");
  }

  static async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.status === status);
  }

  static async getTodoStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
  }> {
    const todos = WebTodoService.read();
    return {
      total: todos.length,
      active: todos.filter((todo) => todo.status === "active").length,
      completed: todos.filter((todo) => todo.status === "completed").length,
      archived: todos.filter((todo) => todo.status === "archived").length,
    };
  }
}

// Lazy import TodoService only when not on web to avoid SQLite dependency
let nativeService: typeof import("./todoService").TodoService | null = null;

const hasJestFlag = (candidate: unknown): candidate is { jest?: unknown } =>
  typeof candidate === "object" && candidate !== null && "jest" in candidate;

const isJestEnv = (() => {
  // Check for Jest global variables
  if (typeof jest !== "undefined") return true;
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test")
    return true;

  // Check for Jest flag in global objects
  const globals = [global, globalThis].filter((g) => typeof g !== "undefined");
  return globals.some((g) => hasJestFlag(g) && Boolean(g.jest));
})();

const getNativeService = async (): Promise<
  typeof import("./todoService").TodoService
> => {
  if (!nativeService) {
    if (isJestEnv) {
      // In Jest environment, use require to avoid dynamic import issues
      const { TodoService } = require("./todoService");
      nativeService = TodoService;
    } else {
      // In normal environment, use dynamic import
      const { TodoService } = await import("./todoService");
      nativeService = TodoService;
    }
  }
  return nativeService as typeof import("./todoService").TodoService;
};

// biome-ignore lint/complexity/noStaticOnlyClass: keeps platform-specific entry points co-located
class PlatformTodoServiceWrapper {
  static async getAllTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getAllTodos();
    }
    const service = await getNativeService();
    return service.getAllTodos();
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    if (isWebPlatform) {
      return WebTodoService.createTodo(input);
    }
    const service = await getNativeService();
    return service.createTodo(input);
  }

  static async updateTodo(input: PlatformUpdatePayload): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.updateTodo(input);
    }
    const service = await getNativeService();
    return service.updateTodo(input.id, input);
  }

  static async deleteTodo(id: number): Promise<boolean> {
    if (isWebPlatform) {
      return WebTodoService.deleteTodo(id);
    }
    const service = await getNativeService();
    return service.deleteTodo(id);
  }

  static async toggleCompleted(id: number): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.toggleCompleted(id);
    }
    const service = await getNativeService();
    // Use getAllTodos for compatibility with tests that mock it
    const allTodos = await service.getAllTodos();
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return null;

    const newStatus = todo.status === "active" ? "completed" : "active";

    const updateInput: UpdateTodoInput = { status: newStatus };
    if (newStatus === "active") {
      // When toggling back to active, we need to provide a priority
      updateInput.priority = 1; // Insert at top
    }
    return service.updateTodo(id, updateInput);
  }

  static async toggleArchived(id: number): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.toggleArchived(id);
    }
    const service = await getNativeService();
    // Use getAllTodos for compatibility with tests that mock it
    const allTodos = await service.getAllTodos();
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return null;

    const newStatus = todo.status === "active" ? "archived" : "active";

    const updateInput: UpdateTodoInput = { status: newStatus };
    if (newStatus === "active") {
      // When toggling back to active, we need to provide a priority
      updateInput.priority = 1; // Insert at top
    }
    return service.updateTodo(id, updateInput);
  }

  static async clearAllTodos(): Promise<void> {
    if (isWebPlatform) {
      return WebTodoService.clearAllTodos();
    }
    const service = await getNativeService();
    return service.clearAllTodos();
  }

  static async getTodoById(id: number): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.getTodoById(id);
    }
    const service = await getNativeService();
    // Use getAllTodos for compatibility with tests that mock it
    const allTodos = await service.getAllTodos();
    return allTodos.find((todo) => todo.id === id) || null;
  }

  static async getActiveTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getActiveTodos();
    }
    const service = await getNativeService();
    return service.getActiveTodos();
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getCompletedTodos();
    }
    const service = await getNativeService();
    return service.getCompletedTodos();
  }

  static async getArchivedTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getArchivedTodos();
    }
    const service = await getNativeService();
    return service.getArchivedTodos();
  }

  static async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getTodosByStatus(status);
    }
    const service = await getNativeService();
    return service.getTodosByStatus(status);
  }

  static async getTodoStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
  }> {
    if (isWebPlatform) {
      return WebTodoService.getTodoStats();
    }
    const service = await getNativeService();
    return service.getTodoStats();
  }
}

export const platformTodoService = PlatformTodoServiceWrapper;
export type PlatformTodoService = typeof platformTodoService;
