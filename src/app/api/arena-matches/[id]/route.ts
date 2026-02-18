import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, notFound, internalError } from '@/lib/api/errors';
import { arenaMatchesService } from '@/lib/services/arena-matches.service';

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const matchId = parseInt(id);

  if (isNaN(matchId)) {
    return validationError('Invalid arena match ID');
  }

  try {
    const match = await arenaMatchesService.getArenaMatch(ctx.organizationId, matchId);

    if (!match) {
      return notFound('Arena match not found');
    }

    return NextResponse.json(match);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
