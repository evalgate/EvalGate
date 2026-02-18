import { type NextRequest, NextResponse } from "next/server";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { benchmarkService } from "@/lib/services/benchmark.service";

export const GET = secureRoute(
  async (req: NextRequest, _ctx: AuthContext, params) => {
    try {
      const { id } = params;
      const benchmarkId = parseInt(id, 10);

      if (Number.isNaN(benchmarkId)) {
        return validationError("Valid benchmark ID is required");
      }

      const { searchParams } = new URL(req.url);
      const sortBy =
        (searchParams.get("sortBy") as "accuracy" | "latency" | "cost" | "score") || "score";
      const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

      const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);
      if (!benchmark) {
        return notFound("Benchmark not found");
      }

      const leaderboard = await benchmarkService.getLeaderboard(benchmarkId, sortBy, limit);

      return NextResponse.json(
        {
          benchmark: {
            id: benchmark.id,
            name: benchmark.name,
            taskType: benchmark.taskType,
          },
          sortBy,
          entries: leaderboard,
          totalEntries: leaderboard.length,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=60",
          },
        },
      );
    } catch (error: unknown) {
      logger.error("Error fetching leaderboard", {
        error: error instanceof Error ? error.message : String(error),
        route: "/api/benchmarks/[id]/leaderboard",
        method: "GET",
      });
      return internalError();
    }
  },
  { rateLimit: "free" },
);
