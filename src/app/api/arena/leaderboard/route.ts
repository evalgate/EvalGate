import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { arenaMatchesService } from "@/lib/services/arena-matches.service";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const days = parseInt(searchParams.get("days") || "30", 10);

  try {
    const leaderboard = await arenaMatchesService.getLeaderboard(ctx.organizationId, {
      limit,
      timeRange: { days },
    });

    const stats = await arenaMatchesService.getArenaStats(ctx.organizationId);

    return NextResponse.json({ leaderboard, stats });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
