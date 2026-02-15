import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiUsageLogs } from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const period = searchParams.get('period') || '7d';

    if (!organizationId) {
      return NextResponse.json({ 
        error: 'organizationId is required',
        code: 'MISSING_ORGANIZATION_ID'
      }, { status: 400 });
    }

    const validPeriods = ['7d', '30d', '90d', 'all'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ 
        error: 'Invalid period. Must be one of: 7d, 30d, 90d, all',
        code: 'INVALID_PERIOD'
      }, { status: 400 });
    }

    const orgId = parseInt(organizationId);
    if (isNaN(orgId)) {
      return NextResponse.json({ 
        error: 'Invalid organizationId',
        code: 'INVALID_ORGANIZATION_ID'
      }, { status: 400 });
    }

    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string | null = null;

    if (period !== 'all') {
      const daysMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const daysAgo = daysMap[period];
      const start = new Date(now);
      start.setDate(start.getDate() - daysAgo);
      startDate = start.toISOString();
    }

    const whereConditions = period === 'all' 
      ? eq(apiUsageLogs.organizationId, orgId)
      : and(
          eq(apiUsageLogs.organizationId, orgId),
          gte(apiUsageLogs.createdAt, startDate!)
        );

    const logs = await db.select()
      .from(apiUsageLogs)
      .where(whereConditions);

    if (logs.length === 0) {
      return NextResponse.json({
        summary: {
          totalRequests: 0,
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          errorRate: 0,
          successRate: 0,
          requestsByStatusCode: {},
          topEndpoints: [],
          requestsOverTime: []
        },
        period: {
          start: startDate,
          end: endDate
        }
      });
    }

    const totalRequests = logs.length;
    const responseTimes = logs.map(log => log.responseTimeMs);
    const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / totalRequests);
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    const errorCount = logs.filter(log => log.statusCode >= 400).length;
    const successCount = totalRequests - errorCount;
    const errorRate = parseFloat(((errorCount / totalRequests) * 100).toFixed(2));
    const successRate = parseFloat(((successCount / totalRequests) * 100).toFixed(2));

    const statusCodeCounts: Record<string, number> = {};
    logs.forEach(log => {
      const code = log.statusCode.toString();
      statusCodeCounts[code] = (statusCodeCounts[code] || 0) + 1;
    });

    const requestsByStatusCode: Record<string, number> = {
      "200": statusCodeCounts["200"] || 0,
      "201": statusCodeCounts["201"] || 0,
      "400": statusCodeCounts["400"] || 0,
      "401": statusCodeCounts["401"] || 0,
      "404": statusCodeCounts["404"] || 0,
      "500": statusCodeCounts["500"] || 0
    };

    const endpointCounts: Record<string, number> = {};
    logs.forEach(log => {
      endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
    });

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dateCounts: Record<string, number> = {};
    logs.forEach(log => {
      const date = log.createdAt.split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });

    const requestsOverTime = Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      summary: {
        totalRequests,
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        errorRate,
        successRate,
        requestsByStatusCode,
        topEndpoints,
        requestsOverTime
      },
      period: {
        start: startDate,
        end: endDate
      }
    });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}