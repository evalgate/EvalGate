import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { internalError } from '@/lib/api/errors';
import { debugAgentService } from '@/lib/services/debug-agent.service';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id, runId } = params;
  const evaluationId = parseInt(id);
  const runIdNum = parseInt(runId);

  try {
    const analysis = await debugAgentService.analyze(
      evaluationId,
      runIdNum,
      ctx.organizationId
    );
    return NextResponse.json(analysis);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
