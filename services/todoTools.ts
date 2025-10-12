import { z } from "zod";
import type { Tool } from "./openaiClient";
import { platformTodoService } from "./platformTodoService";

const createTodoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().optional(),
});

const updateTodoSchema = z.object({
  priority: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  due_date: z.string().optional(),
});

const todoPrioritySchema = z.object({
  priority: z.number(),
});

export const TODO_TOOLS: Tool[] = [
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
          priority: {
            type: "number",
            description: "The priority of the todo to update",
          },
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
        required: ["priority"],
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
          priority: {
            type: "number",
            description: "The priority of the todo to toggle",
          },
        },
        required: ["priority"],
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

      case "toggle_todo": {
        const toggleResult = todoPrioritySchema.safeParse(parsedArgs);
        if (!toggleResult.success) {
          return JSON.stringify({ error: "Invalid priority parameter" });
        }
        const toggledTodo = await platformTodoService.toggleTodo(
          toggleResult.data.priority
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
