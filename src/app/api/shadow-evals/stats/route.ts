import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { shadowEvalService } from "@/lib/services/shadow-eval.service";

export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext) => {
  try {
    const stats = await shadowEvalService.getShadowEvalStats(ctx.organizationId);
    return NextResponse.json(stats);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
