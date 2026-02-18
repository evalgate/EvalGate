import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError } from '@/lib/api/errors';
import { shadowEvalService } from '@/lib/services/shadow-eval.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const shadowRunId = parseInt(id);

  if (isNaN(shadowRunId)) {
    return validationError('Invalid shadow evaluation ID');
  }

  try {
    const result = await shadowEvalService.getShadowEvalResults(ctx.organizationId, shadowRunId);

    if (!result) {
      return notFound('Shadow evaluation not found');
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
