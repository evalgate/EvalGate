import { type NextRequest, NextResponse } from "next/server";
import { internalError, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { regressionService } from "@/lib/services/regression.service";

export const POST = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);

  try {
    const result = await regressionService.runQuick(evaluationId, ctx.organizationId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return validationError(error instanceof Error ? error.message : "Regression failed");
  }
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);
  const body = await req.json();

  if (!body.testCaseIds || !Array.isArray(body.testCaseIds)) {
    return validationError("testCaseIds array is required");
  }

  try {
    const goldenSetId = await regressionService.setGoldenCases(
      evaluationId,
      ctx.organizationId,
      body.testCaseIds,
    );
    return NextResponse.json({ goldenSetId });
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
