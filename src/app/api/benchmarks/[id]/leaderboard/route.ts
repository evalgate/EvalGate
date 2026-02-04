import { NextRequest, NextResponse } from 'next/server';
import { benchmarkService } from '@/lib/services/benchmark.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/benchmarks/[id]/leaderboard - Get benchmark leaderboard
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const benchmarkId = parseInt(id);

      if (isNaN(benchmarkId)) {
        return NextResponse.json({
          error: 'Valid benchmark ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const sortBy = searchParams.get('sortBy') as 'accuracy' | 'latency' | 'cost' | 'score' || 'score';
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

      const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);
      if (!benchmark) {
        return NextResponse.json({
          error: 'Benchmark not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      const leaderboard = await benchmarkService.getLeaderboard(benchmarkId, sortBy, limit);

      return NextResponse.json({
        benchmark: {
          id: benchmark.id,
          name: benchmark.name,
          taskType: benchmark.taskType,
        },
        sortBy,
        entries: leaderboard,
        totalEntries: leaderboard.length,
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (error: any) {
      logger.error('Error fetching leaderboard', {
        error: error.message,
        route: '/api/benchmarks/[id]/leaderboard',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
