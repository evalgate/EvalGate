import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { logger } from "@/lib/logger";
import { workflowService } from "@/lib/services/workflow.service";

const createRunSchema = z.object({
  traceId: z.number().int().positive(),
  input: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/workflows/[id]/runs - List runs for a workflow
 */
export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const workflowId = parseInt(params.id, 10);

    if (Number.isNaN(workflowId)) {
      return validationError("Valid workflow ID is required");
    }

    // Verify workflow belongs to the caller's organization
    const [workflow] = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.organizationId, ctx.organizationId)));

    if (!workflow) {
      return notFound("Workflow not found");
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status") as
      | "running"
      | "completed"
      | "failed"
      | "cancelled"
      | null;

    const runs = await workflowService.listRuns(workflowId, {
      limit,
      offset,
      status: status || undefined,
    });

    return NextResponse.json(runs, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  },
  { rateLimit: "free", requiredScopes: [SCOPES.RUNS_READ] },
);

/**
 * POST /api/workflows/[id]/runs - Create a new workflow run
 */
export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const workflowId = parseInt(params.id, 10);

    if (Number.isNaN(workflowId)) {
      return validationError("Valid workflow ID is required");
    }

    // Verify workflow belongs to the caller's organization
    const [workflow] = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.organizationId, ctx.organizationId)));

    if (!workflow) {
      return notFound("Workflow not found");
    }

    const body = await req.json();

    const validation = createRunSchema.safeParse(body);
    if (!validation.success) {
      return validationError("Invalid request body", validation.error.errors);
    }

    const { traceId, input, metadata } = validation.data;

    const run = await workflowService.createRun({
      workflowId,
      traceId,
      organizationId: ctx.organizationId,
      input,
      metadata,
    });

    logger.info("Workflow run created", {
      runId: run.id,
      workflowId,
      traceId,
      organizationId: ctx.organizationId,
    });

    return NextResponse.json(run, { status: 201 });
  },
  { rateLimit: "free", requiredScopes: [SCOPES.RUNS_WRITE] },
);
