/**
 * Evaluation Versions API
 *
 * GET  /api/evaluations/[id]/versions           — list versions
 * POST /api/evaluations/[id]/versions           — create new version (publish snapshot)
 */

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluations } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { versioningService } from "@/lib/services/versioning.service";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);
    if (Number.isNaN(evaluationId)) return validationError("Valid evaluation ID required");

    // Verify ownership
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(
        and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)),
      )
      .limit(1);

    if (!evaluation) return notFound("Evaluation not found");

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const versions = await versioningService.listVersions(evaluationId, limit, offset);

    return NextResponse.json({ data: versions, count: versions.length });
  },
  { requiredScopes: [SCOPES.EVAL_READ] },
);

export const POST = secureRoute(
  async (_req: NextRequest, ctx: AuthContext, params) => {
    const evaluationId = parseInt(params.id, 10);
    if (Number.isNaN(evaluationId)) return validationError("Valid evaluation ID required");

    // Verify ownership
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(
        and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)),
      )
      .limit(1);

    if (!evaluation) return notFound("Evaluation not found");

    const result = await versioningService.createVersion(
      evaluationId,
      ctx.organizationId,
      ctx.userId,
    );

    return NextResponse.json(result, { status: 201 });
  },
  { requiredScopes: [SCOPES.EVAL_WRITE] },
);
