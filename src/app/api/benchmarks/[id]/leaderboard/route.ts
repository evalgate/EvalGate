import { NextRequest, NextResponse } from 'next/server';
import { benchmarkService } from '@/lib/services/benchmark.service';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  try {
    const { id } = params;
    const benchmarkId = parseInt(id);

    if (isNaN(benchmarkId)) {
      return validationError('Valid benchmark ID is required');
    }

    const { searchParams } = new URL(req.url);
    const sortBy = (searchParams.get('sortBy') as 'accuracy' | 'latency' | 'cost' | 'score') || 'score';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);
    if (!benchmark) {
      return notFound('Benchmark not found');
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
  } catch (error: unknown) {
    logger.error('Error fetching leaderboard', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/benchmarks/[id]/leaderboard',
      method: 'GET',
    });
    return internalError();
  }
}, { rateLimit: 'free' });
