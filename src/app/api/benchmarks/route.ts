import { NextRequest, NextResponse } from 'next/server';
import { benchmarkService } from '@/lib/services/benchmark.service';
import { requireFeature, trackFeature } from '@/lib/autumn-server';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createBenchmarkSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  organizationId: z.number().int().positive(),
  taskType: z.enum(['qa', 'coding', 'reasoning', 'tool_use', 'multi_step']),
  dataset: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
  metrics: z.array(z.string()),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/benchmarks - List benchmarks
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const organizationId = parseInt(searchParams.get('organizationId') || '0');
      const includePublic = searchParams.get('includePublic') !== 'false';

      if (!organizationId) {
        return NextResponse.json({
          error: 'Organization ID is required',
          code: 'MISSING_ORGANIZATION_ID',
        }, { status: 400 });
      }

      const benchmarks = await benchmarkService.listBenchmarks(organizationId, includePublic);

      return NextResponse.json(benchmarks, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (error: any) {
      logger.error('Error listing benchmarks', {
        error: error.message,
        route: '/api/benchmarks',
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
 * POST /api/benchmarks - Create a new benchmark
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    const featureCheck = await requireFeature(req, 'benchmarks', 1);

    if (!featureCheck.allowed) {
      const responseData = await featureCheck.response.json();
      return NextResponse.json(responseData, {
        status: featureCheck.response.status,
      });
    }

    const userId = featureCheck.userId;

    try {
      const body = await req.json();

      const validation = createBenchmarkSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const benchmark = await benchmarkService.createBenchmark({
        ...validation.data,
        createdBy: userId,
      });

      await trackFeature({
        userId,
        featureId: 'benchmarks',
        value: 1,
        idempotencyKey: `benchmark-${benchmark.id}-${Date.now()}`,
      });

      logger.info('Benchmark created', {
        benchmarkId: benchmark.id,
        taskType: benchmark.taskType,
      });

      return NextResponse.json(benchmark, { status: 201 });
    } catch (error: any) {
      logger.error('Error creating benchmark', {
        error: error.message,
        route: '/api/benchmarks',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
