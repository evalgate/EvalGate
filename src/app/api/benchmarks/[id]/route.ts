import { NextRequest, NextResponse } from 'next/server';
import { benchmarkService } from '@/lib/services/benchmark.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/benchmarks/[id] - Get a single benchmark
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

      const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);

      if (!benchmark) {
        return NextResponse.json({
          error: 'Benchmark not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      // Get stats
      const stats = await benchmarkService.getBenchmarkStats(benchmarkId);

      return NextResponse.json({
        benchmark,
        stats,
      });
    } catch (error: any) {
      logger.error('Error fetching benchmark', {
        error: error.message,
        route: '/api/benchmarks/[id]',
        method: 'GET',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}

/**
 * DELETE /api/benchmarks/[id] - Delete a benchmark
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      const organizationId = parseInt(searchParams.get('organizationId') || '0');

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const deleted = await benchmarkService.deleteBenchmark(benchmarkId, organizationId);

      if (!deleted) {
        return NextResponse.json({
          error: 'Benchmark not found or access denied',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Benchmark deleted successfully',
        success: true,
      });
    } catch (error: any) {
      logger.error('Error deleting benchmark', {
        error: error.message,
        route: '/api/benchmarks/[id]',
        method: 'DELETE',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
