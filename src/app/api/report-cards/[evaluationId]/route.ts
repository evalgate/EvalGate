import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, internalError } from '@/lib/api/errors';
import { reportCardsService } from '@/lib/services/report-cards.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { evaluationId } = params;
  const evalId = parseInt(evaluationId);

  if (isNaN(evalId)) {
    return validationError('Invalid evaluation ID');
  }

  try {
    const reportCard = await reportCardsService.generateReportCard(evalId, ctx.organizationId);
    return NextResponse.json(reportCard);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
