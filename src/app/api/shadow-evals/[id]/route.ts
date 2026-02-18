import { type NextRequest, NextResponse } from "next/server";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { shadowEvalService } from "@/lib/services/shadow-eval.service";

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const shadowRunId = parseInt(id, 10);

  if (Number.isNaN(shadowRunId)) {
    return validationError("Invalid shadow evaluation ID");
  }

  try {
    const result = await shadowEvalService.getShadowEvalResults(ctx.organizationId, shadowRunId);

    if (!result) {
      return notFound("Shadow evaluation not found");
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
