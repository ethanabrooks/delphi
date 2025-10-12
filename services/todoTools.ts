import { z } from "zod";
import type { Tool } from "./openaiClient";
import { platformTodoService } from "./platformTodoService";

const createTodoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.number(),
});

const updateTodoSchema = z.object({
  id: z.number(),
  newPriority: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  newStatus: z.enum(["active", "completed", "archived"]).optional(),
  due_date: z.string().optional(),
});

const todoIdentifierSchema = z.object({
  id: z.number(),
});

export const TODO_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "create_todo",
      description:
        "Create a new todo item. IMPORTANT: You MUST specify a priority to control the exact position of the todo in the list.",
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
          priority: {
            type: "number",
            description:
              "CRITICAL: The priority/position of the todo (lower numbers = higher priority). This parameter is mandatory and determines where the todo appears in the list. Use 1 for highest priority, 2 for second highest, etc. Existing todos at this priority and below will be automatically bumped down.",
          },
        },
        required: ["title", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo",
      description:
        "Update an existing todo item. Requires the todo ID to identify the todo to update.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "The unique ID of the todo to update",
          },
          newPriority: {
            type: "number",
            description:
              "New priority to move the todo to (optional). If provided, other todos in the target status will be bumped down to maintain ordering.",
          },
          title: { type: "string", description: "New title for the todo" },
          description: {
            type: "string",
            description: "New description for the todo",
          },
          newStatus: {
            type: "string",
            description:
              "New status for the todo: 'active', 'completed', or 'archived'",
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
      name: "toggle_todo",
      description:
        "Toggle the completed status of a todo. Requires the todo ID to identify the todo.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "The unique ID of the todo to toggle",
          },
        },
        required: ["id"],
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
      case "create_todo": {
        const createResult = createTodoSchema.safeParse(parsedArgs);
        if (!createResult.success) {
          return JSON.stringify({
            error: "Invalid create todo parameters",
            details: createResult.error.issues,
          });
        }

        // Check for duplicate todos before creating
        const activeTodos = await platformTodoService.getActiveTodos();
        const newTitle = createResult.data.title.trim().toLowerCase();
        const existingTodo = activeTodos.find(
          (todo) => todo.title.trim().toLowerCase() === newTitle
        );

        if (existingTodo) {
          return JSON.stringify({
            duplicate: true,
            message: `A todo with the title "${existingTodo.title}" already exists (Priority ${existingTodo.priority}). Please update the existing todo instead of creating a duplicate.`,
            existingTodo: existingTodo,
          });
        }

        const newTodo = await platformTodoService.createTodo({
          title: createResult.data.title,
          description: createResult.data.description,
          due_date: createResult.data.due_date,
          priority: createResult.data.priority,
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
        const updatedTodo = await platformTodoService.updateTodo({
          id: updateResult.data.id,
          title: updateResult.data.title,
          description: updateResult.data.description,
          due_date: updateResult.data.due_date,
          status: updateResult.data.newStatus,
          priority: updateResult.data.newPriority,
        });
        return JSON.stringify(updatedTodo);
      }

      case "toggle_todo": {
        const toggleResult = todoIdentifierSchema.safeParse(parsedArgs);
        if (!toggleResult.success) {
          return JSON.stringify({
            error: "Invalid parameters - priority and status required",
            details: toggleResult.error.issues,
          });
        }
        const toggledTodo = await platformTodoService.toggleTodo(
          toggleResult.data.id
        );
        return JSON.stringify(toggledTodo);
      }

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({
      error: `Function execution failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
