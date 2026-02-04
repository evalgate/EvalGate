import { NextRequest, NextResponse } from 'next/server';
import { benchmarkService } from '@/lib/services/benchmark.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const submitResultSchema = z.object({
  agentConfigId: z.number().int().positive(),
  workflowRunId: z.number().int().positive().optional(),
  accuracy: z.number().min(0).max(100).optional(),
  latencyP50: z.number().nonnegative().optional(),
  latencyP95: z.number().nonnegative().optional(),
  totalCost: z.string().optional(),
  successRate: z.number().min(0).max(100).optional(),
  toolUseEfficiency: z.number().min(0).max(100).optional(),
  customMetrics: z.record(z.any()).optional(),
});

/**
 * POST /api/benchmarks/[id]/results - Submit benchmark result
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

      const body = await req.json();

      const validation = submitResultSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const result = await benchmarkService.submitResult({
        benchmarkId,
        ...validation.data,
      });

      logger.info('Benchmark result submitted', {
        benchmarkId,
        agentConfigId: validation.data.agentConfigId,
        accuracy: validation.data.accuracy,
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
      logger.error('Error submitting benchmark result', {
        error: error.message,
        route: '/api/benchmarks/[id]/results',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
