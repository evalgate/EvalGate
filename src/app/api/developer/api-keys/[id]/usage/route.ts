import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiUsageLogs, apiKeys } from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get and validate ID from params
    const { id } = await params;
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid API key ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const apiKeyId = parseInt(id);

    // Verify API key belongs to current user
    const apiKey = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, user.id)))
      .limit(1);

    if (apiKey.length === 0) {
      return NextResponse.json(
        { error: 'API key not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Calculate date range based on period
    const periodMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    const days = periodMap[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get all logs for the period (for statistics)
    const allLogs = await db
      .select()
      .from(apiUsageLogs)
      .where(
        and(
          eq(apiUsageLogs.apiKeyId, apiKeyId),
          gte(apiUsageLogs.createdAt, startDateStr)
        )
      );

    // Calculate usage statistics
    const totalRequests = allLogs.length;

    const avgResponseTime =
      totalRequests > 0
        ? allLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) /
          totalRequests
        : 0;

    const errorCount = allLogs.filter(
      (log) => log.statusCode >= 400
    ).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    // Group by endpoint
    const endpointMap = new Map<string, number>();
    allLogs.forEach((log) => {
      const count = endpointMap.get(log.endpoint) || 0;
      endpointMap.set(log.endpoint, count + 1);
    });

    const requestsByEndpoint = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count);

    // Group by date
    const dateMap = new Map<string, number>();
    allLogs.forEach((log) => {
      const date = log.createdAt.split('T')[0]; // Extract YYYY-MM-DD
      const count = dateMap.get(date) || 0;
      dateMap.set(date, count + 1);
    });

    const requestsByDay = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent logs with pagination
    const recentLogs = await db
      .select()
      .from(apiUsageLogs)
      .where(
        and(
          eq(apiUsageLogs.apiKeyId, apiKeyId),
          gte(apiUsageLogs.createdAt, startDateStr)
        )
      )
      .orderBy(desc(apiUsageLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Return comprehensive usage data
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
  } catch (error) {
    console.error('GET api usage stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}