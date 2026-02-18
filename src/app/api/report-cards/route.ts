import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { reportCardsService } from "@/lib/services/report-cards.service";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const options: Record<string, unknown> = {};
    if (searchParams.has("limit")) {
      options.limit = parseInt(searchParams.get("limit") || "10", 10);
    }
    if (searchParams.has("offset")) {
      options.offset = parseInt(searchParams.get("offset") || "0", 10);
    }
    if (searchParams.has("evaluationType")) {
      options.evaluationType = searchParams.get("evaluationType");
    }

    const cards = await reportCardsService.getReportCards(ctx.organizationId, options);
    return NextResponse.json(cards);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
