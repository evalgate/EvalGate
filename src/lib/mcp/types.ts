/**
 * MCP (Model Context Protocol) types for EvalAI tool registry.
 */

export interface McpToolInputSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
  requiredScopes?: string[];
  /** Optional version for future migrations. */
  version?: string;
  /** If true, tool may return 202 with job ID for async polling. */
  longRunning?: boolean;
}

export interface McpToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
