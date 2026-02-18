import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { costService } from "@/lib/services/cost.service";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      const now = new Date();
      const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const start = startDate || defaultStartDate.toISOString().split("T")[0];
      const end = endDate || now.toISOString().split("T")[0];

      const trends = await costService.getCostTrends(ctx.organizationId, start, end);

      return NextResponse.json(
        {
          organizationId: ctx.organizationId,
          startDate: start,
          endDate: end,
          trends,
          summary: {
            totalCost: trends.reduce((sum, t) => sum + t.totalCost, 0),
            totalTokens: trends.reduce((sum, t) => sum + t.tokenCount, 0),
            totalRequests: trends.reduce((sum, t) => sum + t.requestCount, 0),
            avgDailyCost:
              trends.length > 0
                ? trends.reduce((sum, t) => sum + t.totalCost, 0) / trends.length
                : 0,
          },
        },
        {
          headers: {
            "Cache-Control": "private, max-age=300",
          },
        },
      );
    } catch (error: unknown) {
      logger.error("Error fetching cost trends", {
        error: error instanceof Error ? error.message : String(error),
        route: "/api/costs/trends",
        method: "GET",
      });
      return internalError();
    }
  },
  { rateLimit: "free" },
);
