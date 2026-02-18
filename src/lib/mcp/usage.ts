/**
 * MCP tool execution usage tracking.
 * Logs to api_usage_logs for per-API-key tool execution counts.
 */

import { db } from "@/db";
import { apiUsageLogs } from "@/db/schema";

export async function trackMcpToolExecution(params: {
  toolName: string;
  statusCode: number;
  durationMs: number;
  organizationId: number;
  userId: string;
  apiKeyId?: number;
}): Promise<void> {
  try {
    await db.insert(apiUsageLogs).values({
      endpoint: `mcp:${params.toolName}`,
      method: "POST",
      statusCode: params.statusCode,
      responseTimeMs: params.durationMs,
      organizationId: params.organizationId,
      userId: params.userId,
      apiKeyId: params.apiKeyId ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Fire-and-forget; don't block the response
    console.error("MCP usage tracking failed", err);
  }
}
