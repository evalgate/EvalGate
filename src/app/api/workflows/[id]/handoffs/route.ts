import { NextRequest, NextResponse } from 'next/server';
import { workflowService } from '@/lib/services/workflow.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const createHandoffSchema = z.object({
  workflowRunId: z.number().int().positive(),
  fromSpanId: z.string().optional(),
  toSpanId: z.string(),
  fromAgent: z.string().optional(),
  toAgent: z.string(),
  handoffType: z.enum(['delegation', 'escalation', 'parallel', 'fallback']),
  context: z.record(z.any()).optional(),
});

/**
 * GET /api/workflows/[id]/handoffs - Get handoff statistics for a workflow
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
      const runId = searchParams.get('runId');

      // If runId is provided, get handoffs for that specific run
      if (runId) {
        const runIdNum = parseInt(runId);
        if (isNaN(runIdNum)) {
          return NextResponse.json({
            error: 'Valid run ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        const handoffs = await workflowService.listHandoffs(runIdNum);
        return NextResponse.json(handoffs);
      }

      // Otherwise, get handoff statistics for the workflow
      const stats = await workflowService.getHandoffStats(workflowId);

      return NextResponse.json({
        workflowId,
        handoffStats: stats,
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      });
    } catch (error: any) {
      logger.error('Error fetching handoffs', {
        error: error.message,
        route: '/api/workflows/[id]/handoffs',
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
 * POST /api/workflows/[id]/handoffs - Create a new handoff
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
      const validation = createHandoffSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const handoff = await workflowService.createHandoff(validation.data);

      logger.info('Handoff created', {
        handoffId: handoff.id,
        workflowId,
        runId: validation.data.workflowRunId,
        type: validation.data.handoffType,
      });

      return NextResponse.json(handoff, { status: 201 });
    } catch (error: any) {
      logger.error('Error creating handoff', {
        error: error.message,
        route: '/api/workflows/[id]/handoffs',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
