import { type NextRequest, NextResponse } from "next/server";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { driftService } from "@/lib/services/drift.service";
import { parsePaginationParams } from "@/lib/validation";

/**
 * GET /api/drift/alerts — list drift alerts for the org
 */
export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const evaluationId = searchParams.get("evaluationId")
      ? parseInt(searchParams.get("evaluationId")!, 10)
      : undefined;
    const { limit, offset } = parsePaginationParams(searchParams);

    const alerts = await driftService.listAlerts(ctx.organizationId, {
      evaluationId,
      limit,
      offset,
    });

    return NextResponse.json({ data: alerts, count: alerts.length });
  },
  { requiredScopes: [SCOPES.EVAL_READ] },
);

/**
 * POST /api/drift/alerts — trigger drift detection (internal / cron)
 */
export const POST = secureRoute(
  async (_req: NextRequest, ctx: AuthContext) => {
    const result = await driftService.detectDrift(ctx.organizationId);
    return NextResponse.json(result);
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);
