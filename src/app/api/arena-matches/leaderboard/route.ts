import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { internalError } from '@/lib/api/errors';
import { arenaMatchesService } from '@/lib/services/arena-matches.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const options: Record<string, unknown> = {};
    if (searchParams.has('limit')) {
      options.limit = parseInt(searchParams.get('limit') || '10');
    }
    if (searchParams.has('days')) {
      options.timeRange = { days: parseInt(searchParams.get('days') || '30') };
    }

    const leaderboard = await arenaMatchesService.getLeaderboard(ctx.organizationId, options);
    return NextResponse.json(leaderboard);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
