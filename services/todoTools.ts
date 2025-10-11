import { z } from "zod";
import type { Priority } from "../types/todo";
import type { Tool } from "./openaiClient";
import { TodoService } from "./todoService";

const createTodoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.number().min(1).max(3).optional(),
  category: z.string().optional(),
  due_date: z.string().optional(),
});

const updateTodoSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  priority: z.number().min(1).max(3).optional(),
  category: z.string().optional(),
  due_date: z.string().optional(),
});

const todoIdSchema = z.object({
  id: z.number(),
});

const prioritySchema = z.object({
  priority: z.number().min(1).max(3),
});

export const TODO_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_all_todos",
      description: "Get all todos from the database",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todo_by_id",
      description: "Get a specific todo by its ID",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The ID of the todo to retrieve" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_todo",
      description: "Create a new todo item",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title of the todo" },
          description: {
            type: "string",
            description: "Optional description of the todo",
          },
          priority: {
            type: "number",
            description: "Priority level: 1 (low), 2 (medium), 3 (high)",
            minimum: 1,
            maximum: 3,
          },
          category: {
            type: "string",
            description: "Optional category for the todo",
          },
          due_date: {
            type: "string",
            description: "Optional due date in ISO format",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo",
      description: "Update an existing todo item",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The ID of the todo to update" },
          title: { type: "string", description: "New title for the todo" },
          description: {
            type: "string",
            description: "New description for the todo",
          },
          completed: {
            type: "boolean",
            description: "Whether the todo is completed",
          },
          priority: {
            type: "number",
            description: "Priority level: 1 (low), 2 (medium), 3 (high)",
            minimum: 1,
            maximum: 3,
          },
          category: {
            type: "string",
            description: "New category for the todo",
          },
          due_date: {
            type: "string",
            description: "New due date in ISO format",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_todo",
      description: "Delete a todo item by ID",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The ID of the todo to delete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_todo",
      description: "Toggle the completed status of a todo",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The ID of the todo to toggle" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_incomplete_todos",
      description: "Get all incomplete todos",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_completed_todos",
      description: "Get all completed todos",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todos_by_priority",
      description: "Get todos filtered by priority level",
      parameters: {
        type: "object",
        properties: {
          priority: {
            type: "number",
            description: "Priority level: 1 (low), 2 (medium), 3 (high)",
            minimum: 1,
            maximum: 3,
          },
        },
        required: ["priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todo_stats",
      description:
        "Get statistics about todos (total, completed, pending, high priority)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_all_todos",
      description: "Delete all todos from the database",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

export async function executeTodoFunction(
  name: string,
  args: string
): Promise<string> {
  let parsedArgs: unknown;

  try {
    parsedArgs = JSON.parse(args);
  } catch (_error) {
    return JSON.stringify({ error: "Invalid JSON arguments" });
  }

  try {
    switch (name) {
      case "get_all_todos": {
        const allTodos = await TodoService.getAllTodos();
        return JSON.stringify(allTodos);
      }

      case "get_todo_by_id": {
        const idResult = todoIdSchema.safeParse(parsedArgs);
        if (!idResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const todo = await TodoService.getTodoById(idResult.data.id);
        return JSON.stringify(todo);
      }

      case "create_todo": {
        const createResult = createTodoSchema.safeParse(parsedArgs);
        if (!createResult.success) {
          return JSON.stringify({
            error: "Invalid create todo parameters",
            details: createResult.error.issues,
          });
        }
        const newTodo = await TodoService.createTodo({
          ...createResult.data,
          priority: createResult.data.priority as Priority,
        });
        return JSON.stringify(newTodo);
      }

      case "update_todo": {
        const updateResult = updateTodoSchema.safeParse(parsedArgs);
        if (!updateResult.success) {
          return JSON.stringify({
            error: "Invalid update todo parameters",
            details: updateResult.error.issues,
          });
        }
        const updatedTodo = await TodoService.updateTodo({
          ...updateResult.data,
          priority: updateResult.data.priority as Priority,
        });
        return JSON.stringify(updatedTodo);
      }

      case "delete_todo": {
        const deleteResult = todoIdSchema.safeParse(parsedArgs);
        if (!deleteResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const deleteSuccess = await TodoService.deleteTodo(
          deleteResult.data.id
        );
        return JSON.stringify({ success: deleteSuccess });
      }

      case "toggle_todo": {
        const toggleResult = todoIdSchema.safeParse(parsedArgs);
        if (!toggleResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const toggledTodo = await TodoService.toggleTodo(toggleResult.data.id);
        return JSON.stringify(toggledTodo);
      }

      case "get_incomplete_todos": {
        const incompleteTodos = await TodoService.getIncompleteTodos();
        return JSON.stringify(incompleteTodos);
      }

      case "get_completed_todos": {
        const completedTodos = await TodoService.getCompletedTodos();
        return JSON.stringify(completedTodos);
      }

      case "get_todos_by_priority": {
        const priorityResult = prioritySchema.safeParse(parsedArgs);
        if (!priorityResult.success) {
          return JSON.stringify({ error: "Invalid priority parameter" });
        }
        const priorityTodos = await TodoService.getTodosByPriority(
          priorityResult.data.priority as Priority
        );
        return JSON.stringify(priorityTodos);
      }

      case "get_todo_stats": {
        const stats = await TodoService.getTodoStats();
        return JSON.stringify(stats);
      }

      case "clear_all_todos":
        await TodoService.clearAllTodos();
        return JSON.stringify({ success: true, message: "All todos cleared" });

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({
      error: `Function execution failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
