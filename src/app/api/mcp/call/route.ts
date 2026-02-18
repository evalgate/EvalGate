/**
 * POST /api/mcp/call
 * Execute an MCP tool. Requires authentication.
 * Body: { tool: string, arguments: Record<string, unknown> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext, hasScopes } from '@/lib/api/secure-route';
import { MCP_TOOLS, executeMcpTool } from '@/lib/mcp/registry';
import { McpCallBodySchema, ToolArgs, type ToolName } from '@/lib/mcp/schemas';
import { McpToolError } from '@/lib/mcp/errors';
import { trackMcpToolExecution } from '@/lib/mcp/usage';
import { apiError } from '@/lib/api/errors';
import { getRequestId } from '@/lib/api/request-id';
import { logger } from '@/lib/logger';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, _params: Record<string, string>) => {
  if (ctx.authType === 'anonymous') {
    return apiError('UNAUTHORIZED', 'Authentication required for tool execution');
  }

  let parsedBody: { tool: string; arguments: Record<string, unknown> };
  try {
    const raw = await req.json();
    const result = McpCallBodySchema.safeParse(raw);
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Invalid MCP body', undefined, result.error.issues);
    }
    parsedBody = result.data;
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body');
  }

  const toolName = parsedBody.tool as ToolName;
  const toolSchema = ToolArgs[toolName];
  if (!toolSchema) {
    return apiError('VALIDATION_ERROR', `Unknown tool: ${toolName}`);
  }

  const parsedArgs = toolSchema.safeParse(parsedBody.arguments);
  if (!parsedArgs.success) {
    const msg = parsedArgs.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return apiError('VALIDATION_ERROR', `Invalid arguments for ${toolName}: ${msg}`, undefined, parsedArgs.error.issues);
  }

  const definition = MCP_TOOLS.find((t) => t.name === toolName);
  if (definition?.requiredScopes?.length) {
    const scopes = 'scopes' in ctx ? ctx.scopes : [];
    if (!hasScopes(scopes, definition.requiredScopes)) {
      return apiError('FORBIDDEN', `Insufficient scope for tool ${toolName}`);
    }
  }

  const start = performance.now();
  let response: NextResponse;
  let statusCode: number;

  try {
    const result = await executeMcpTool(toolName, parsedArgs.data, ctx);
    statusCode = 200;
    response = NextResponse.json({
      ok: true,
      content: [
        { type: 'json' as const, json: result },
        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
      ],
    });
  } catch (err) {
    const requestId = getRequestId();
    if (err instanceof McpToolError) {
      statusCode = err.status;
      logger.warn('MCP tool failed', {
        toolName,
        code: err.code,
        status: err.status,
        requestId,
      });
      response = NextResponse.json(
        {
          ok: false,
          error: { code: err.code, message: err.message, requestId },
        },
        { status: err.status },
      );
    } else {
      statusCode = 500;
      logger.error({ toolName, requestId, err }, 'MCP tool crashed');
      response = NextResponse.json(
        {
          ok: false,
          error: { code: 'INTERNAL' as const, message: 'Tool execution failed', requestId },
        },
        { status: 500 },
      );
    }
  }

  const durationMs = Math.round(performance.now() - start);
  logger.info('MCP tool executed', {
    toolName,
    status: statusCode >= 400 ? 'error' : 'ok',
    durationMs,
    statusCode,
  });

  trackMcpToolExecution({
    toolName,
    statusCode,
    durationMs,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    apiKeyId: ctx.apiKeyId,
  });

  return response;
}, { rateLimit: 'mcp' });
