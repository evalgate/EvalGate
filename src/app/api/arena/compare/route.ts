import { NextRequest, NextResponse } from 'next/server';
import { secureRoute, type AuthContext } from '@/lib/api/secure-route';
import { validationError, internalError } from '@/lib/api/errors';
import { comparisonEngine } from '@/lib/arena/comparison-engine';
import { arenaMatchesService } from '@/lib/services/arena-matches.service';

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const body = await req.json();
  const { prompt, models, judgeConfigId } = body;

  if (!prompt || !models || !Array.isArray(models) || models.length < 2) {
    return validationError('prompt (string) and models (array of ≥2 model IDs) are required');
  }

  try {
    const comparison = await comparisonEngine.compare({
      prompt,
      models,
      organizationId: ctx.organizationId,
    });

    const match = await arenaMatchesService.createArenaMatch(
      ctx.organizationId,
      { prompt, models, judgeConfigId },
      ctx.userId
    );

    return NextResponse.json({
      matchId: match.id,
      winner: { modelId: match.winnerId, label: match.winnerLabel },
      responses: comparison.responses,
      scores: match.scores,
    }, { status: 201 });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
