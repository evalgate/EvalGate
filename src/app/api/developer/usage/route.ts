import { and, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiUsageLogs } from "@/db/schema";
import { validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") || "7d";
  const groupBy = searchParams.get("groupBy") || "endpoint";
  const { limit, offset } = parsePaginationParams(searchParams);

  // Validate period
  const validPeriods = ["7d", "30d", "90d"];
  if (!validPeriods.includes(period)) {
    return validationError("Invalid period. Must be one of: 7d, 30d, 90d");
  }

  // Validate groupBy
  const validGroupBy = ["endpoint", "method", "day"];
  if (!validGroupBy.includes(groupBy)) {
    return validationError("Invalid groupBy. Must be one of: endpoint, method, day");
  }

  // Calculate period date range
  const now = new Date();
  const periodDays = parseInt(period.replace("d", ""), 10);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const startDateStr = startDate.toISOString();
  const endDateStr = now.toISOString();

  // Use ctx.organizationId instead of query param
  const logs = await db
    .select()
    .from(apiUsageLogs)
    .where(
      and(
        eq(apiUsageLogs.organizationId, ctx.organizationId),
        gte(apiUsageLogs.createdAt, startDateStr),
      ),
    );

  if (logs.length === 0) {
    return NextResponse.json({
      analytics: {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        successRate: 100,
        groupedData: [],
      },
      period: {
        start: startDateStr,
        end: endDateStr,
      },
    });
  }

  // Calculate overall metrics
  const totalRequests = logs.length;
  const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTimeMs, 0);
  const avgResponseTime = Math.round(totalResponseTime / totalRequests);
  const errorCount = logs.filter((log) => log.statusCode >= 400).length;
  const errorRate = parseFloat(((errorCount / totalRequests) * 100).toFixed(2));
  const successRate = parseFloat((100 - errorRate).toFixed(2));

  // Group data based on groupBy parameter
  const grouped = new Map<string, { count: number; totalResponseTime: number }>();

  logs.forEach((log) => {
    let key: string;

    if (groupBy === "endpoint") {
      key = log.endpoint;
    } else if (groupBy === "method") {
      key = log.method;
    } else {
      // groupBy === 'day'
      const date = new Date(log.createdAt);
      key = date.toISOString().split("T")[0];
    }

    if (!grouped.has(key)) {
      grouped.set(key, { count: 0, totalResponseTime: 0 });
    }

    const current = grouped.get(key)!;
    current.count += 1;
    current.totalResponseTime += log.responseTimeMs;
  });

  // Convert grouped data to array format with pagination
  const groupedArray = Array.from(grouped.entries())
    .map(([key, data]) => ({
      key,
      count: data.count,
      avgResponseTime: Math.round(data.totalResponseTime / data.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(offset, offset + limit);

  return NextResponse.json(
    {
      analytics: {
        totalRequests,
        avgResponseTime,
        errorRate,
        successRate,
        groupedData: groupedArray,
      },
      period: {
        start: startDateStr,
        end: endDateStr,
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=240",
      },
    },
  );
});
