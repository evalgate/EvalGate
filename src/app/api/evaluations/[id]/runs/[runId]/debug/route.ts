import { type NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { debugAgentService } from "@/lib/services/debug-agent.service";

export const POST = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const { id, runId } = params;
  const evaluationId = parseInt(id, 10);
  const runIdNum = parseInt(runId, 10);

  try {
    const analysis = await debugAgentService.analyze(evaluationId, runIdNum, ctx.organizationId);
    return NextResponse.json(analysis);
  } catch (error: unknown) {
    return internalError(error instanceof Error ? error.message : undefined);
  }
});
