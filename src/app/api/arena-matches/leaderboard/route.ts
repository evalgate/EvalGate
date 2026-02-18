import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { arenaMatchesService } from "@/lib/services/arena-matches.service";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const options: Record<string, unknown> = {};
    if (searchParams.has("limit")) {
      options.limit = parseInt(searchParams.get("limit") || "10", 10);
    }
    if (searchParams.has("days")) {
      options.timeRange = { days: parseInt(searchParams.get("days") || "30", 10) };
    }

    const leaderboard = await arenaMatchesService.getLeaderboard(ctx.organizationId, options);
    return NextResponse.json(leaderboard);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
