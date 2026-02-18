import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { internalError } from '@/lib/api/errors';
import { arenaMatchesService } from '@/lib/services/arena-matches.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const days = parseInt(searchParams.get('days') || '30');

  try {
    const leaderboard = await arenaMatchesService.getLeaderboard(
      ctx.organizationId,
      { limit, timeRange: { days } }
    );

    const stats = await arenaMatchesService.getArenaStats(ctx.organizationId);

    return NextResponse.json({ leaderboard, stats });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
