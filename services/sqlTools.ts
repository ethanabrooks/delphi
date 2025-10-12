import type { Tool } from "./openaiClient";
import { executeQuery, formatResults } from "./sqlService";

// SQL tools for OpenAI function calling
export const SQL_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "execute_sql_query",
      description:
        "Execute a read-only SQL query on the todos database to analyze data, generate statistics, or perform advanced searches. Only SELECT queries are allowed for security.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The SQL SELECT query to execute. Must be a valid SELECT statement. No DML operations (INSERT, UPDATE, DELETE) or DDL operations (CREATE, DROP, ALTER) are allowed.",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Execute SQL function for tool calling
export async function executeSqlFunction(
  name: string,
  args: string
): Promise<string> {
  if (name !== "execute_sql_query") {
    return `❌ Unknown SQL function: ${name}`;
  }

  try {
    const { query } = JSON.parse(args);

    if (!query || typeof query !== "string") {
      return "❌ Invalid query: 'query' parameter must be a non-empty string";
    }

    const result = await executeQuery(query);
    return formatResults(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return "❌ Invalid function arguments: Expected JSON format";
    }
    return `❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
