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

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const period = searchParams.get('period') || '7d';
    const groupBy = searchParams.get('groupBy') || 'endpoint';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate organizationId
    if (!organizationId) {
      return NextResponse.json({ 
        error: 'organizationId query parameter is required',
        code: 'MISSING_ORGANIZATION_ID'
      }, { status: 400 });
    }

    const orgId = parseInt(organizationId);
    if (isNaN(orgId)) {
      return NextResponse.json({ 
        error: 'Invalid organizationId',
        code: 'INVALID_ORGANIZATION_ID'
      }, { status: 400 });
    }

    // Validate period
    const validPeriods = ['7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ 
        error: 'Invalid period. Must be one of: 7d, 30d, 90d',
        code: 'INVALID_PERIOD'
      }, { status: 400 });
    }

    // Validate groupBy
    const validGroupBy = ['endpoint', 'method', 'day'];
    if (!validGroupBy.includes(groupBy)) {
      return NextResponse.json({ 
        error: 'Invalid groupBy. Must be one of: endpoint, method, day',
        code: 'INVALID_GROUP_BY'
      }, { status: 400 });
    }

    // Calculate period date range
    const now = new Date();
    const periodDays = parseInt(period.replace('d', ''));
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - periodDays);

    const startDateStr = startDate.toISOString();
    const endDateStr = now.toISOString();

    // Get all logs for the period and organization
    const logs = await db.select()
      .from(apiUsageLogs)
      .where(
        and(
          eq(apiUsageLogs.organizationId, orgId),
          gte(apiUsageLogs.createdAt, startDateStr)
        )
      );

    if (logs.length === 0) {
      return NextResponse.json({
        analytics: {
          totalRequests: 0,
          avgResponseTime: 0,
          errorRate: 0,
          successRate: 100,
          groupedData: []
        },
        period: {
          start: startDateStr,
          end: endDateStr
        }
      });
    }

    // Calculate overall metrics
    const totalRequests = logs.length;
    const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTimeMs, 0);
    const avgResponseTime = Math.round(totalResponseTime / totalRequests);
    const errorCount = logs.filter(log => log.statusCode >= 400).length;
    const errorRate = parseFloat(((errorCount / totalRequests) * 100).toFixed(2));
    const successRate = parseFloat((100 - errorRate).toFixed(2));

    // Group data based on groupBy parameter
    const grouped = new Map<string, { count: number; totalResponseTime: number }>();

    logs.forEach(log => {
      let key: string;
      
      if (groupBy === 'endpoint') {
        key = log.endpoint;
      } else if (groupBy === 'method') {
        key = log.method;
      } else {
        // groupBy === 'day'
        const date = new Date(log.createdAt);
        key = date.toISOString().split('T')[0];
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
        avgResponseTime: Math.round(data.totalResponseTime / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(offset, offset + limit);

    return NextResponse.json({
      analytics: {
        totalRequests,
        avgResponseTime,
        errorRate,
        successRate,
        groupedData: groupedArray
      },
      period: {
        start: startDateStr,
        end: endDateStr
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=240'
      }
    });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}