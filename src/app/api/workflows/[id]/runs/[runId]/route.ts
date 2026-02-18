import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { workflowService } from "@/lib/services/workflow.service";

const updateRunSchema = z.object({
  status: z.enum(["running", "completed", "failed", "cancelled"]).optional(),
  output: z.record(z.any()).optional(),
  totalCost: z.string().optional(),
  totalDurationMs: z.number().int().nonnegative().optional(),
  agentCount: z.number().int().nonnegative().optional(),
  handoffCount: z.number().int().nonnegative().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/workflows/[id]/runs/[runId] - Get a single workflow run
 */
export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const workflowId = parseInt(params.id, 10);
    const runIdNum = parseInt(params.runId, 10);

    if (Number.isNaN(workflowId)) {
      return validationError("Valid workflow ID is required");
    }

    if (Number.isNaN(runIdNum)) {
      return validationError("Valid run ID is required");
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
    const includeDetails = searchParams.get("includeDetails") === "true";

    if (includeDetails) {
      const result = await workflowService.getRunWithDetails(runIdNum);
      if (!result) {
        return notFound("Workflow run not found");
      }
      return NextResponse.json(result);
    }

    const run = await workflowService.getRunById(runIdNum);

    if (!run) {
      return notFound("Workflow run not found");
    }

    return NextResponse.json(run, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  },
  { rateLimit: "free" },
);

/**
 * PUT /api/workflows/[id]/runs/[runId] - Update a workflow run
 */
export const PUT = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const workflowId = parseInt(params.id, 10);
    const runIdNum = parseInt(params.runId, 10);

    if (Number.isNaN(workflowId)) {
      return validationError("Valid workflow ID is required");
    }

    if (Number.isNaN(runIdNum)) {
      return validationError("Valid run ID is required");
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

    const validation = updateRunSchema.safeParse(body);
    if (!validation.success) {
      return validationError("Invalid request body", validation.error.errors);
    }

    const updateData = {
      ...validation.data,
      errorMessage: validation.data.errorMessage ?? undefined,
    };
    const updated = await workflowService.updateRun(runIdNum, updateData);

    if (!updated) {
      return notFound("Workflow run not found");
    }

    logger.info("Workflow run updated", {
      runId: runIdNum,
      workflowId,
      status: validation.data.status,
      organizationId: ctx.organizationId,
    });

    return NextResponse.json(updated);
  },
  { rateLimit: "free" },
);
