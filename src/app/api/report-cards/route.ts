import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { reportCardsService } from "@/lib/services/report-cards.service";
import { parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePaginationParams(searchParams);
    const options: Record<string, unknown> = { limit, offset };
    if (searchParams.has("evaluationType")) {
      options.evaluationType = searchParams.get("evaluationType");
    }

    const cards = await reportCardsService.getReportCards(ctx.organizationId, options);
    return NextResponse.json(cards);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
