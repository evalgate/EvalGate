import { NextRequest, NextResponse } from 'next/server';
import { costService } from '@/lib/services/cost.service';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, internalError, zodValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createCostRecordSchema = z.object({
  spanId: z.number().int().positive(),
  workflowRunId: z.number().int().positive().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  category: z.enum(['llm', 'tool', 'embedding', 'other']).optional(),
  isRetry: z.boolean().optional(),
  retryNumber: z.number().int().nonnegative().optional(),
});

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const workflowRunId = searchParams.get('workflowRunId');
    const traceId = searchParams.get('traceId');
    const breakdown = searchParams.get('breakdown') === 'true';

    if (workflowRunId) {
      const id = parseInt(workflowRunId);
      if (isNaN(id)) {
        return validationError('Valid workflow run ID is required');
      }

      if (breakdown) {
        const result = await costService.aggregateWorkflowCost(id);
        return NextResponse.json(result);
      }

      const records = await costService.listByWorkflowRun(id);
      return NextResponse.json(records);
    }

    if (traceId) {
      const id = parseInt(traceId);
      if (isNaN(id)) {
        return validationError('Valid trace ID is required');
      }

      const result = await costService.getCostBreakdownByTrace(id);
      return NextResponse.json(result);
    }

    const summary = await costService.getOrganizationCostSummary(ctx.organizationId);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    logger.error('Error fetching costs', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/costs',
      method: 'GET',
    });
    return internalError();
  }
}, { rateLimit: 'free' });

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();

    const validation = createCostRecordSchema.safeParse(body);
    if (!validation.success) {
      return zodValidationError(validation.error);
    }

    const record = await costService.createRecord({
      ...validation.data,
      organizationId: ctx.organizationId,
    });

    logger.info('Cost record created', {
      recordId: record.id,
      provider: validation.data.provider,
      model: validation.data.model,
      totalCost: record.totalCost,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating cost record', {
      error: error instanceof Error ? error.message : String(error),
      route: '/api/costs',
      method: 'POST',
    });
    return internalError();
  }
}, { rateLimit: 'free' });
