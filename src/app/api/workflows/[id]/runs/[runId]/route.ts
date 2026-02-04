import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

const updateRunSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  output: z.record(z.any()).optional(),
  totalCost: z.string().optional(),
  totalDurationMs: z.number().int().nonnegative().optional(),
  agentCount: z.number().int().nonnegative().optional(),
  handoffCount: z.number().int().nonnegative().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/workflows/[id]/runs/[runId] - Get a single workflow run
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { runId } = await params;
      const runIdNum = parseInt(runId);

      if (isNaN(runIdNum)) {
        return NextResponse.json({
          error: 'Valid run ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const includeDetails = searchParams.get('includeDetails') === 'true';

      if (includeDetails) {
        const result = await workflowService.getRunWithDetails(runIdNum);
        if (!result) {
          return NextResponse.json({
            error: 'Workflow run not found',
            code: 'NOT_FOUND',
          }, { status: 404 });
        }
        return NextResponse.json(result);
      }

      const run = await workflowService.getRunById(runIdNum);

      if (!run) {
        return NextResponse.json({
          error: 'Workflow run not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      return NextResponse.json(run, {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      });
    } catch (error: any) {
      logger.error('Error fetching workflow run', {
        error: error.message,
        route: '/api/workflows/[id]/runs/[runId]',
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
 * PUT /api/workflows/[id]/runs/[runId] - Update a workflow run
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { runId } = await params;
      const runIdNum = parseInt(runId);

      if (isNaN(runIdNum)) {
        return NextResponse.json({
          error: 'Valid run ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const body = await req.json();

      // Validate request body
      const validation = updateRunSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const updated = await workflowService.updateRun(runIdNum, validation.data);

      if (!updated) {
        return NextResponse.json({
          error: 'Workflow run not found',
          code: 'NOT_FOUND',
        }, { status: 404 });
      }

      logger.info('Workflow run updated', {
        runId: runIdNum,
        status: validation.data.status,
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      logger.error('Error updating workflow run', {
        error: error.message,
        route: '/api/workflows/[id]/runs/[runId]',
        method: 'PUT',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
