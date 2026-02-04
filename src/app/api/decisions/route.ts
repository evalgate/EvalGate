import { NextRequest, NextResponse } from 'next/server';
import { decisionService } from '@/lib/services/decision.service';
import { withRateLimit } from '@/lib/api-rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createDecisionSchema = z.object({
  spanId: z.number().int().positive(),
  workflowRunId: z.number().int().positive().optional(),
  agentName: z.string().min(1),
  decisionType: z.enum(['action', 'tool', 'delegate', 'respond', 'route']),
  chosen: z.string().min(1),
  alternatives: z.array(z.object({
    action: z.string(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string().optional(),
    rejectedReason: z.string().optional(),
  })),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  inputContext: z.record(z.any()).optional(),
});

/**
 * GET /api/decisions - List decisions
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const workflowRunId = searchParams.get('workflowRunId');
      const spanId = searchParams.get('spanId');
      const decisionId = searchParams.get('id');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const offset = parseInt(searchParams.get('offset') || '0');
      const agentName = searchParams.get('agentName');
      const decisionType = searchParams.get('decisionType');
      const minConfidence = searchParams.get('minConfidence');

      // Get single decision
      if (decisionId) {
        const id = parseInt(decisionId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid decision ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        // Check if comparison is requested
        const includeComparison = searchParams.get('includeComparison') === 'true';
        
        if (includeComparison) {
          const comparison = await decisionService.getDecisionComparison(id);
          if (!comparison) {
            return NextResponse.json({
              error: 'Decision not found',
              code: 'NOT_FOUND',
            }, { status: 404 });
          }
          return NextResponse.json(comparison);
        }

        const decision = await decisionService.getById(id);
        if (!decision) {
          return NextResponse.json({
            error: 'Decision not found',
            code: 'NOT_FOUND',
          }, { status: 404 });
        }
        return NextResponse.json(decision);
      }

      // List by span
      if (spanId) {
        const id = parseInt(spanId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid span ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }
        const decisions = await decisionService.listBySpan(id);
        return NextResponse.json(decisions);
      }

      // List by workflow run
      if (workflowRunId) {
        const id = parseInt(workflowRunId);
        if (isNaN(id)) {
          return NextResponse.json({
            error: 'Valid workflow run ID is required',
            code: 'INVALID_ID',
          }, { status: 400 });
        }

        const decisions = await decisionService.listByWorkflowRun(id, {
          limit,
          offset,
          agentName: agentName || undefined,
          decisionType: decisionType || undefined,
          minConfidence: minConfidence ? parseInt(minConfidence) : undefined,
        });

        return NextResponse.json(decisions);
      }

      return NextResponse.json({
        error: 'Either workflowRunId, spanId, or id is required',
        code: 'MISSING_PARAMETER',
      }, { status: 400 });
    } catch (error: any) {
      logger.error('Error fetching decisions', {
        error: error.message,
        route: '/api/decisions',
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
 * POST /api/decisions - Create a new decision
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, async (req: NextRequest) => {
    try {
      const body = await req.json();

      // Validate request body
      const validation = createDecisionSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        }, { status: 400 });
      }

      const decision = await decisionService.create(validation.data);

      logger.info('Decision created', {
        decisionId: decision.id,
        agent: validation.data.agentName,
        type: validation.data.decisionType,
      });

      return NextResponse.json(decision, { status: 201 });
    } catch (error: any) {
      logger.error('Error creating decision', {
        error: error.message,
        route: '/api/decisions',
        method: 'POST',
      });
      return NextResponse.json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }
  }, { customTier: 'free' });
}
