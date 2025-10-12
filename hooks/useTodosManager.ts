import * as React from "react";
import { initializeDatabase } from "../db/database";
import {
  isWebPlatform,
  platformTodoService,
} from "../services/platformTodoService";
import type {
  CreateTodoInput,
  Todo,
  TodoStatus,
  UpdateTodoInput,
} from "../types/todo";

type MutationType = "add" | "update" | "toggle" | "delete" | null;

type TodoStats = {
  total: number;
  active: number;
  completed: number;
  archived: number;
};

export interface UseTodosManagerResult {
  todos: Todo[];
  stats: TodoStats;
  isLoading: boolean;
  error: string | null;
  lastMutation: MutationType;
  addTodo: (input: CreateTodoInput) => Promise<void>;
  updateTodo: (input: UpdateTodoInput & { id: number }) => Promise<void>;
  toggleCompleted: (id: number) => Promise<void>;
  toggleArchived: (id: number) => Promise<void>;
  deleteTodo: (identifier: number, status: TodoStatus) => Promise<void>;
  refetch: () => Promise<void>;
}

const formatError = (prefix: string, error: unknown) =>
  `${prefix}: ${error instanceof Error ? error.message : String(error)}`;

const globalReactContainer = globalThis as {
  __delphiReactSingleton?: typeof React;
};

let sharedReact = globalReactContainer.__delphiReactSingleton;
if (!sharedReact) {
  sharedReact = React;
  globalReactContainer.__delphiReactSingleton = sharedReact;
}

const { useCallback, useEffect, useMemo, useState } = sharedReact;

export default function useTodosManager(): UseTodosManagerResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastMutation, setLastMutation] = useState<MutationType>(null);

  const loadTodos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const records = await platformTodoService.getAllTodos();
      setTodos(records);
    } catch (loadError) {
      setError(formatError("Failed to load todos", loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!isWebPlatform) {
          await initializeDatabase();
        }
        await loadTodos();
      } catch (initializationError) {
        setError(
          formatError("Database initialization failed", initializationError)
        );
        setIsLoading(false);
      }
    };

    void initialize();
  }, [loadTodos]);

  const addTodo = useCallback(async (input: CreateTodoInput) => {
    try {
      setLastMutation("add");
      setError(null);
      const created = await platformTodoService.createTodo(input);
      setTodos((previous) => [created, ...previous]);
    } catch (addError) {
      setError(formatError("Failed to add todo", addError));
    } finally {
      setLastMutation(null);
    }
  }, []);

  const updateTodo = useCallback(
    async (input: UpdateTodoInput & { id: number }) => {
      try {
        setLastMutation("update");
        setError(null);
        const updated = await platformTodoService.updateTodo(input);

        if (!updated) {
          setError("Todo not found");
          return;
        }

        setTodos((previous) =>
          previous.map((todo) => (todo.id === updated.id ? updated : todo))
        );
      } catch (updateError) {
        setError(formatError("Failed to update todo", updateError));
      } finally {
        setLastMutation(null);
      }
    },
    []
  );

  const toggleCompleted = useCallback(async (id: number) => {
    try {
      setLastMutation("toggle");
      setError(null);
      const toggled = await platformTodoService.toggleCompleted(id);

      if (!toggled) {
        setError("Failed to toggle completed status");
        return;
      }

      setTodos((previous) =>
        previous.map((todo) => (todo.id === toggled.id ? toggled : todo))
      );
    } catch (toggleError) {
      setError(formatError("Failed to toggle completed status", toggleError));
    } finally {
      setLastMutation(null);
    }
  }, []);

  const toggleArchived = useCallback(async (id: number) => {
    try {
      setLastMutation("toggle");
      setError(null);
      const toggled = await platformTodoService.toggleArchived(id);

      if (!toggled) {
        setError("Failed to toggle archived status");
        return;
      }

      setTodos((previous) =>
        previous.map((todo) => (todo.id === toggled.id ? toggled : todo))
      );
    } catch (toggleError) {
      setError(formatError("Failed to toggle archived status", toggleError));
    } finally {
      setLastMutation(null);
    }
  }, []);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      setLastMutation("delete");
      setError(null);
      const success = await platformTodoService.deleteTodo(id);

      if (!success) {
        setError("Todo not found");
        return;
      }

      setTodos((previous) => previous.filter((todo) => todo.id !== id));
    } catch (deleteError) {
      setError(formatError("Failed to delete todo", deleteError));
    } finally {
      setLastMutation(null);
    }
  }, []);

  const stats = useMemo<TodoStats>(() => {
    const total = todos.length;
    const active = todos.filter((todo) => todo.status === "active").length;
    const completed = todos.filter(
      (todo) => todo.status === "completed"
    ).length;
    const archived = todos.filter((todo) => todo.status === "archived").length;

    return { total, active, completed, archived };
  }, [todos]);

  const refetch = useCallback(async () => {
    await loadTodos();
  }, [loadTodos]);

  return {
    todos,
    stats,
    isLoading,
    error,
    lastMutation,
    addTodo,
    updateTodo,
    toggleCompleted,
    toggleArchived,
    deleteTodo,
    refetch,
  };
}
