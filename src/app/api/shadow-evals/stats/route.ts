import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { internalError } from '@/lib/api/errors';
import { shadowEvalService } from '@/lib/services/shadow-eval.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const stats = await shadowEvalService.getShadowEvalStats(ctx.organizationId);
    return NextResponse.json(stats);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
