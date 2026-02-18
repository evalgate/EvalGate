import { NextRequest, NextResponse } from 'next/server';
import { decisionService } from '@/lib/services/decision.service';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError, zodValidationError } from '@/lib/api/errors';
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

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
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

    if (decisionId) {
      const id = parseInt(decisionId);
      if (isNaN(id)) {
        return validationError('Valid decision ID is required');
      }

      const includeComparison = searchParams.get('includeComparison') === 'true';

      if (includeComparison) {
        const comparison = await decisionService.getDecisionComparison(id);
        if (!comparison) {
          return notFound('Decision not found');
        }
        return NextResponse.json(comparison);
      }

      const decision = await decisionService.getById(id);
      if (!decision) {
        return notFound('Decision not found');
      }
      return NextResponse.json(decision);
    }

    if (spanId) {
      const id = parseInt(spanId);
      if (isNaN(id)) {
        return validationError('Valid span ID is required');
      }
      const decisions = await decisionService.listBySpan(id);
      return NextResponse.json(decisions);
    }

    if (workflowRunId) {
      const id = parseInt(workflowRunId);
      if (isNaN(id)) {
        return validationError('Valid workflow run ID is required');
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

    return validationError('Either workflowRunId, spanId, or id is required');
  } catch (error: unknown) {
    logger.error('Error fetching decisions', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/decisions',
      method: 'GET',
    });
    return internalError();
  }
}, { rateLimit: 'free' });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();

    const validation = createDecisionSchema.safeParse(body);
    if (!validation.success) {
      return zodValidationError(validation.error);
    }

    const decision = await decisionService.create({
      ...validation.data,
      organizationId: ctx.organizationId,
    });

    logger.info('Decision created', {
      decisionId: decision.id,
      agent: validation.data.agentName,
      type: validation.data.decisionType,
    });

    return NextResponse.json(decision, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating decision', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/decisions',
      method: 'POST',
    });
    return internalError();
  }
}, { rateLimit: 'free' });
