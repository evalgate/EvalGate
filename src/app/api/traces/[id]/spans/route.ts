import { type NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { spanService } from "@/lib/services/span.service";
import { createSpanBodySchema, parsePaginationParams } from "@/lib/validation";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const traceId = parseInt(params.id, 10);

    if (Number.isNaN(traceId)) {
      return validationError("Valid trace ID is required");
    }

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePaginationParams(searchParams);

    const result = await spanService.listByTrace(ctx.organizationId, traceId, { limit, offset });

    if (result === null) {
      return notFound("Trace not found");
    }

    return NextResponse.json(result);
  },
  { requiredScopes: [SCOPES.TRACES_READ] },
);

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const traceId = parseInt(params.id, 10);

    if (Number.isNaN(traceId)) {
      return validationError("Valid trace ID is required");
    }

    const parsed = await parseBody(req, createSpanBodySchema);
    if (!parsed.ok) return parsed.response;

    const {
      spanId,
      name,
      type,
      parentSpanId,
      input,
      output,
      durationMs,
      startTime,
      endTime,
      metadata,
      evaluationRunId,
    } = parsed.data;

    const result = await spanService.create(ctx.organizationId, traceId, {
      spanId,
      name,
      type,
      parentSpanId,
      input,
      output,
      durationMs,
      startTime,
      endTime,
      metadata,
      evaluationRunId,
    });

    if (typeof result === "object" && "ok" in result && result.ok === false) {
      if (result.reason === "run_not_in_org") return forbidden("Run not in organization");
      return forbidden("Trace not in organization");
    }

    return NextResponse.json(result, { status: 201 });
  },
  { requiredScopes: [SCOPES.TRACES_WRITE] },
);
