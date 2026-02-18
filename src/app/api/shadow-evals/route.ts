import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { internalError, zodValidationError } from '@/lib/api/errors';
import { shadowEvalService } from '@/lib/services/shadow-eval.service';
import { z } from 'zod';

const createShadowEvalSchema = z.object({
  evaluationId: z.number(),
  traceIds: z.array(z.string()),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  filters: z.object({
    status: z.array(z.string()).optional(),
    duration: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).optional(),
});

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createShadowEvalSchema.parse(body);

    const result = await shadowEvalService.createShadowEval(
      ctx.organizationId,
      parsed,
      ctx.userId
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return zodValidationError(error);
    }
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
