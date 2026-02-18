import { type NextRequest, NextResponse } from "next/server";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { arenaMatchesService } from "@/lib/services/arena-matches.service";

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const matchId = parseInt(id, 10);

  if (Number.isNaN(matchId)) {
    return validationError("Invalid arena match ID");
  }

  try {
    const match = await arenaMatchesService.getArenaMatch(ctx.organizationId, matchId);

    if (!match) {
      return notFound("Arena match not found");
    }

    return NextResponse.json(match);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
