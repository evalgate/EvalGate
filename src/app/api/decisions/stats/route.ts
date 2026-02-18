import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { traces, workflowRuns, workflows } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { decisionService } from "@/lib/services/decision.service";

/**
 * GET /api/decisions/stats - Get decision statistics scoped to the user's organization
 */
export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const workflowRunId = searchParams.get("workflowRunId");
    const workflowId = searchParams.get("workflowId");
    const traceId = searchParams.get("traceId");

    // Get stats for a workflow run
    if (workflowRunId) {
      const id = parseInt(workflowRunId, 10);
      if (Number.isNaN(id)) {
        return validationError("Valid workflow run ID is required");
      }

      // Verify the workflow run belongs to this organization
      const run = await db
        .select()
        .from(workflowRuns)
        .where(and(eq(workflowRuns.id, id), eq(workflowRuns.organizationId, ctx.organizationId)))
        .limit(1);

      if (!run[0]) {
        return notFound("Workflow run not found");
      }

      const stats = await decisionService.getWorkflowDecisionStats(id);
      return NextResponse.json(stats);
    }

    // Get decision patterns for a workflow
    if (workflowId) {
      const id = parseInt(workflowId, 10);
      if (Number.isNaN(id)) {
        return validationError("Valid workflow ID is required");
      }

      // Verify the workflow belongs to this organization
      const workflow = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.organizationId, ctx.organizationId)))
        .limit(1);

      if (!workflow[0]) {
        return notFound("Workflow not found");
      }

      const patterns = await decisionService.getAgentDecisionPatterns(id);
      return NextResponse.json(patterns);
    }

    // Get audit trail for a trace
    if (traceId) {
      const id = parseInt(traceId, 10);
      if (Number.isNaN(id)) {
        return validationError("Valid trace ID is required");
      }

      // Verify the trace belongs to this organization
      const trace = await db
        .select()
        .from(traces)
        .where(and(eq(traces.id, id), eq(traces.organizationId, ctx.organizationId)))
        .limit(1);

      if (!trace[0]) {
        return notFound("Trace not found");
      }

      const auditTrail = await decisionService.getDecisionAuditTrail(id);
      return NextResponse.json(auditTrail);
    }

    return validationError("Either workflowRunId, workflowId, or traceId is required");
  },
  { rateLimit: "free" },
);
