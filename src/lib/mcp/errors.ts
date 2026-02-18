/**
 * MCP tool execution errors.
 * Enables correct HTTP status and error code mapping.
 */

export type McpErrorCode =
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INTERNAL';

export class McpToolError extends Error {
  constructor(
    public code: McpErrorCode,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}
