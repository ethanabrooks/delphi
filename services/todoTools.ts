import { z } from "zod";
import type { TodoStatus } from "../types/todo";
import type { Tool } from "./openaiClient";
import { platformTodoService } from "./platformTodoService";

const createTodoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().optional(),
});

const updateTodoSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  due_date: z.string().optional(),
});

const todoIdSchema = z.object({
  id: z.number(),
});

const statusSchema = z.object({
  status: z.enum(["active", "completed", "archived"]),
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
          status: {
            type: "string",
            description:
              "Status of the todo: 'active', 'completed', or 'archived'",
            enum: ["active", "completed", "archived"],
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
      name: "get_active_todos",
      description: "Get all active todos",
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
      name: "get_todos_by_status",
      description: "Get todos filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Status to filter by: 'active', 'completed', or 'archived'",
            enum: ["active", "completed", "archived"],
          },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_todos",
      description: "Get all active todos",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_archived_todos",
      description: "Get all archived todos",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todo_stats",
      description:
        "Get statistics about todos (total, active, completed, archived)",
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
        const allTodos = await platformTodoService.getAllTodos();
        return JSON.stringify(allTodos);
      }

      case "get_todo_by_id": {
        const idResult = todoIdSchema.safeParse(parsedArgs);
        if (!idResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const todo = await platformTodoService.getTodoById(idResult.data.id);
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
        const newTodo = await platformTodoService.createTodo(createResult.data);
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
        const updatedTodo = await platformTodoService.updateTodo(
          updateResult.data
        );
        return JSON.stringify(updatedTodo);
      }

      case "delete_todo": {
        const deleteResult = todoIdSchema.safeParse(parsedArgs);
        if (!deleteResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const deleteSuccess = await platformTodoService.deleteTodo(
          deleteResult.data.id
        );
        return JSON.stringify({ success: deleteSuccess });
      }

      case "toggle_todo": {
        const toggleResult = todoIdSchema.safeParse(parsedArgs);
        if (!toggleResult.success) {
          return JSON.stringify({ error: "Invalid ID parameter" });
        }
        const toggledTodo = await platformTodoService.toggleTodo(
          toggleResult.data.id
        );
        return JSON.stringify(toggledTodo);
      }

      case "get_active_todos": {
        const activeTodos = await platformTodoService.getActiveTodos();
        return JSON.stringify(activeTodos);
      }

      case "get_completed_todos": {
        const completedTodos = await platformTodoService.getCompletedTodos();
        return JSON.stringify(completedTodos);
      }

      case "get_todos_by_status": {
        const statusResult = statusSchema.safeParse(parsedArgs);
        if (!statusResult.success) {
          return JSON.stringify({ error: "Invalid status parameter" });
        }
        const statusTodos = await platformTodoService.getTodosByStatus(
          statusResult.data.status as TodoStatus
        );
        return JSON.stringify(statusTodos);
      }

      case "get_archived_todos": {
        const archivedTodos = await platformTodoService.getArchivedTodos();
        return JSON.stringify(archivedTodos);
      }

      case "get_todo_stats": {
        const stats = await platformTodoService.getTodoStats();
        return JSON.stringify(stats);
      }

      case "clear_all_todos":
        await platformTodoService.clearAllTodos();
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
