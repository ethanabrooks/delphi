import { db } from "../db/database";

export interface SqlQueryResult {
  success: boolean;
  data?: unknown[];
  error?: string;
  rowCount?: number;
}

export class SqlService {
  /**
   * Execute a safe SQL query (read-only SELECT queries only)
   * Validates queries to prevent dangerous operations
   */
  static async executeQuery(query: string): Promise<SqlQueryResult> {
    try {
      // Validate query is safe (only SELECT queries allowed)
      const trimmedQuery = query.trim().toLowerCase();

      if (!trimmedQuery.startsWith("select")) {
        return {
          success: false,
          error: "Only SELECT queries are allowed for security reasons",
        };
      }

      // Check for dangerous keywords
      const dangerousKeywords = [
        "delete",
        "update",
        "insert",
        "drop",
        "create",
        "alter",
        "truncate",
        "replace",
        "exec",
        "execute",
        "pragma",
      ];

      for (const keyword of dangerousKeywords) {
        if (trimmedQuery.includes(keyword)) {
          return {
            success: false,
            error: `Query contains prohibited keyword: ${keyword}`,
          };
        }
      }

      // Execute the query
      const database = await db();
      const results = await database.all(query);

      return {
        success: true,
        data: results,
        rowCount: Array.isArray(results) ? results.length : 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format query results in a table-like format for display
   */
  static formatResults(result: SqlQueryResult): string {
    if (!result.success) {
      return `❌ Query failed: ${result.error}`;
    }

    if (
      !result.data ||
      !Array.isArray(result.data) ||
      result.data.length === 0
    ) {
      return "✅ Query executed successfully. No results found.";
    }

    const rows = result.data as Record<string, unknown>[];
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);

    // Create header
    let output = "✅ Query Results:\n\n";

    // Table header
    const headerRow = columns.join(" | ");
    const separator = columns.map((col) => "-".repeat(col.length)).join(" | ");

    output += `${headerRow}\n`;
    output += `${separator}\n`;

    // Table rows
    for (const row of rows) {
      const rowValues = columns.map((col) => String(row[col] || ""));
      output += `${rowValues.join(" | ")}\n`;
    }

    output += `\n(${result.rowCount} rows)`;

    return output;
  }
}
