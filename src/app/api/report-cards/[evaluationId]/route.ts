import { type NextRequest, NextResponse } from "next/server";
import { internalError, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { reportCardsService } from "@/lib/services/report-cards.service";

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { evaluationId } = params;
  const evalId = parseInt(evaluationId, 10);

  if (Number.isNaN(evalId)) {
    return validationError("Invalid evaluation ID");
  }

  try {
    const reportCard = await reportCardsService.generateReportCard(evalId, ctx.organizationId);
    return NextResponse.json(reportCard);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
