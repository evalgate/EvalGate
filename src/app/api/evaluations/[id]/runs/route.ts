import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluationRuns, evaluations } from "@/db/schema";
import { forbidden, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { evaluationService } from "@/lib/services/evaluation.service";
import { createRunBodySchema } from "@/lib/validation";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);

  if (Number.isNaN(evaluationId)) {
    return validationError("Valid evaluation ID is required");
  }

  const evalCheck = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(
      and(eq(evaluations.id, evaluationId), eq(evaluations.organizationId, ctx.organizationId)),
    )
    .limit(1);

  if (evalCheck.length === 0) {
    return notFound("Evaluation not found");
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const status = searchParams.get("status");

  const conditions = [eq(evaluationRuns.evaluationId, evaluationId)];
  if (status) {
    conditions.push(eq(evaluationRuns.status, status));
  }

  const query = db
    .select()
    .from(evaluationRuns)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

  const runs = await query.orderBy(desc(evaluationRuns.createdAt)).limit(limit).offset(offset);

  return NextResponse.json(runs);
});

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext, params) => {
  const { id } = params;
  const evaluationId = parseInt(id, 10);

  if (Number.isNaN(evaluationId)) {
    return validationError("Valid evaluation ID is required");
  }

  const parsed = await parseBody(req, createRunBodySchema, { allowEmpty: true });
  if (!parsed.ok) return parsed.response;

  const body = parsed.data ?? {};
  let environment: "dev" | "staging" | "prod" = "dev";
  const envHeader = req.headers.get("x-evalai-env")?.toLowerCase();
  const bodyEnv = body.environment?.toLowerCase();
  const requested = (envHeader || bodyEnv) as "dev" | "staging" | "prod" | undefined;
  if (requested === "prod" || requested === "staging" || requested === "dev") {
    environment = requested;
  }

  if (environment === "prod") {
    const isAdmin = ctx.role === "owner" || ctx.role === "admin";
    const isApiKey = ctx.authType === "apiKey";
    if (!isAdmin && !isApiKey) {
      return forbidden("Only admins or API keys can tag runs as prod");
    }
  }

  const run = await evaluationService.run(evaluationId, ctx.organizationId, { environment });

  if (!run) {
    return notFound("Evaluation not found");
  }

  return NextResponse.json(run, { status: 201 });
});
