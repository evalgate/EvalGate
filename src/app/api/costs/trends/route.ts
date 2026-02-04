import { NextRequest, NextResponse } from 'next/server';
import { costService } from '@/lib/services/cost.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/costs/trends - Get cost trends over time
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const organizationId = searchParams.get('organizationId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const id = parseInt(organizationId);
      if (isNaN(id)) {
        return NextResponse.json({
          error: 'Valid organization ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      // Default to last 30 days if not specified
      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const start = startDate || defaultStartDate.toISOString().split('T')[0];
      const end = endDate || now.toISOString().split('T')[0];

      const trends = await costService.getCostTrends(id, start, end);

      return NextResponse.json({
        organizationId: id,
        startDate: start,
        endDate: end,
        trends,
        summary: {
          totalCost: trends.reduce((sum, t) => sum + t.totalCost, 0),
          totalTokens: trends.reduce((sum, t) => sum + t.tokenCount, 0),
          totalRequests: trends.reduce((sum, t) => sum + t.requestCount, 0),
          avgDailyCost: trends.length > 0 
            ? trends.reduce((sum, t) => sum + t.totalCost, 0) / trends.length 
            : 0,
        },
      }, {
        headers: {
          'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        },
      });
    } catch (error: any) {
      logger.error('Error fetching cost trends', {
        error: error.message,
        route: '/api/costs/trends',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
