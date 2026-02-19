import { and, desc, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys, apiUsageLogs } from "@/db/schema";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid API key ID is required");
    }

    const apiKeyId = parseInt(id, 10);

    const apiKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, apiKeyId),
          eq(apiKeys.userId, ctx.userId),
          eq(apiKeys.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);

    if (apiKey.length === 0) {
      return notFound("API key not found");
    }

    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period") || "7d";
    const { limit, offset } = parsePaginationParams(searchParams);

    const periodMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };

    const days = periodMap[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const allLogs = await db
      .select()
      .from(apiUsageLogs)
      .where(and(eq(apiUsageLogs.apiKeyId, apiKeyId), gte(apiUsageLogs.createdAt, startDateStr)));

    const totalRequests = allLogs.length;

    const avgResponseTime =
      totalRequests > 0
        ? allLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) / totalRequests
        : 0;

    const errorCount = allLogs.filter((log) => log.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const endpointMap = new Map<string, number>();
    allLogs.forEach((log) => {
      const count = endpointMap.get(log.endpoint) || 0;
      endpointMap.set(log.endpoint, count + 1);
    });

    const requestsByEndpoint = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count);

    const dateMap = new Map<string, number>();
    allLogs.forEach((log) => {
      const date = log.createdAt.split("T")[0];
      const count = dateMap.get(date) || 0;
      dateMap.set(date, count + 1);
    });

    const requestsByDay = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recentLogs = await db
      .select()
      .from(apiUsageLogs)
      .where(and(eq(apiUsageLogs.apiKeyId, apiKeyId), gte(apiUsageLogs.createdAt, startDateStr)))
      .orderBy(desc(apiUsageLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      usage: {
        totalRequests,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        requestsByEndpoint,
        requestsByDay,
      },
      logs: recentLogs,
    });
  } catch (_error: unknown) {
    return internalError();
  }
});
