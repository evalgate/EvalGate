import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, internalError } from '@/lib/api/errors';
import { regressionService } from '@/lib/services/regression.service';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id);

  try {
    const result = await regressionService.runQuick(evaluationId, ctx.organizationId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return validationError(error instanceof Error ? error.message : 'Regression failed');
  }
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id);
  const body = await req.json();

  if (!body.testCaseIds || !Array.isArray(body.testCaseIds)) {
    return validationError('testCaseIds array is required');
  }

  try {
    const goldenSetId = await regressionService.setGoldenCases(
      evaluationId,
      ctx.organizationId,
      body.testCaseIds
    );
    return NextResponse.json({ goldenSetId });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
