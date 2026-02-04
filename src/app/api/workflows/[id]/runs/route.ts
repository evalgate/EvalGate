import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const createRunSchema = z.object({
  traceId: z.number().int().positive(),
  input: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/workflows/[id]/runs - List runs for a workflow
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const workflowId = parseInt(id);

      if (isNaN(workflowId)) {
        return NextResponse.json({
          error: 'Valid workflow ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');
      const status = searchParams.get('status') as 'running' | 'completed' | 'failed' | 'cancelled' | null;

      const runs = await workflowService.listRuns(workflowId, {
        limit,
        offset,
        status: status || undefined,
      });

      return NextResponse.json(runs, {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      });
    } catch (error: any) {
      logger.error('Error listing workflow runs', {
        error: error.message,
        route: '/api/workflows/[id]/runs',
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
 * POST /api/workflows/[id]/runs - Create a new workflow run
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { id } = await params;
      const workflowId = parseInt(id);

      if (isNaN(workflowId)) {
        return NextResponse.json({
          error: 'Valid workflow ID is required',
          code: 'INVALID_ID',
        }, { status: 400 });
      }

      const body = await req.json();

      // Validate request body
      const validation = createRunSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const { traceId, input, metadata } = validation.data;

      const run = await workflowService.createRun({
        workflowId,
        traceId,
        input,
        metadata,
      });

      logger.info('Workflow run created', {
        runId: run.id,
        workflowId,
        traceId,
      });

      return NextResponse.json(run, { status: 201 });
    } catch (error: any) {
      logger.error('Error creating workflow run', {
        error: error.message,
        route: '/api/workflows/[id]/runs',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
