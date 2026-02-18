/**
 * GET /api/mcp/tools
 * Public tool discovery. Returns list of MCP tools with input schemas.
 * Anonymous access allowed for discovery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureRoute } from '@/lib/api/secure-route';
import { MCP_TOOLS } from '@/lib/mcp/registry';

export const GET = secureRoute(async (_req: NextRequest, _ctx: unknown, _params: Record<string, string>) => {
  const response = NextResponse.json({
    mcpVersion: '1',
    tools: MCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      ...(t.version && { version: t.version }),
      ...(t.longRunning && { longRunning: t.longRunning }),
    })),
  });
  response.headers.set(
    'Cache-Control',
    'public, max-age=300, stale-while-revalidate=86400',
  );
  return response;
}, { allowAnonymous: true, rateLimit: 'anonymous' });
