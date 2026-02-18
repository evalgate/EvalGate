import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { spans, traces } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { updateTraceBodySchema } from "@/lib/validation";

export const GET = secureRoute(
  async (_req: NextRequest, ctx: AuthContext, params) => {
    const traceId = parseInt(params.id, 10);

    // Fetch trace
    const traceData = await db.select().from(traces).where(eq(traces.id, traceId)).limit(1);

    if (traceData.length === 0) {
      return notFound("Trace not found");
    }

    // Verify org ownership
    if (traceData[0].organizationId !== ctx.organizationId) {
      return notFound("Trace not found");
    }

    // Fetch all spans for this trace ordered by start time
    const traceSpans = await db
      .select()
      .from(spans)
      .where(eq(spans.traceId, traceId))
      .orderBy(asc(spans.startTime));

    return NextResponse.json({ trace: traceData[0], spans: traceSpans });
  },
  { requiredScopes: [SCOPES.TRACES_READ] },
);

export const PATCH = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const traceId = parseInt(params.id, 10);
    if (Number.isNaN(traceId)) {
      return validationError("Valid trace ID is required");
    }

    // Verify trace belongs to org
    const existing = await db
      .select()
      .from(traces)
      .where(and(eq(traces.id, traceId), eq(traces.organizationId, ctx.organizationId)))
      .limit(1);

    if (existing.length === 0) {
      return notFound("Trace not found");
    }

    const parsed = await parseBody(req, updateTraceBodySchema);
    if (!parsed.ok) return parsed.response;

    const body = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.durationMs !== undefined) updateData.durationMs = body.durationMs;
    if (body.metadata !== undefined) {
      // Merge metadata
      const existingMeta =
        typeof existing[0].metadata === "string"
          ? JSON.parse(existing[0].metadata)
          : (existing[0].metadata ?? {});
      updateData.metadata = JSON.stringify({ ...existingMeta, ...body.metadata });
    }

    const [updated] = await db
      .update(traces)
      .set(updateData)
      .where(and(eq(traces.id, traceId), eq(traces.organizationId, ctx.organizationId)))
      .returning();

    return NextResponse.json(updated);
  },
  { requiredScopes: [SCOPES.TRACES_WRITE] },
);
