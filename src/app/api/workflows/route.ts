import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  internalError,
  quotaExceeded,
  validationError,
  zodValidationError,
} from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { checkFeature, trackFeature } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { workflowService } from "@/lib/services/workflow.service";

const workflowDefinitionSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["agent", "tool", "decision", "parallel", "human", "llm"]),
      name: z.string(),
      config: z.record(z.any()).optional(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      condition: z.string().optional(),
      label: z.string().optional(),
    }),
  ),
  entrypoint: z.string(),
  metadata: z.record(z.any()).optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  organizationId: z.number().int().positive(),
  definition: workflowDefinitionSchema,
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const status = searchParams.get("status") as "draft" | "active" | "archived" | null;
      const search = searchParams.get("search");

      const workflows = await workflowService.list(ctx.organizationId, {
        limit,
        offset,
        status: status || undefined,
        search: search || undefined,
      });

      return NextResponse.json(workflows, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      });
    } catch (error: unknown) {
      logger.error("Error listing workflows", {
        error: error instanceof Error ? error.message : String(error),
        route: "/api/workflows",
        method: "GET",
      });
      return internalError();
    }
  },
  { rateLimit: "free" },
);

export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    const featureCheck = await checkFeature({
      userId: ctx.userId,
      featureId: "workflows",
      requiredBalance: 1,
    });

    if (!featureCheck.allowed) {
      return quotaExceeded("Workflows limit reached. Upgrade your plan to increase quota.", {
        featureId: "workflows",
        remaining: featureCheck.remaining || 0,
      });
    }

    const orgLimitCheck = await checkFeature({
      userId: ctx.userId,
      featureId: "workflows_per_project",
      requiredBalance: 1,
    });

    if (!orgLimitCheck.allowed) {
      return quotaExceeded(
        "You've reached your workflow limit for this organization. Please upgrade your plan.",
      );
    }

    try {
      const body = await req.json();
      const validation = createWorkflowSchema.safeParse(body);
      if (!validation.success) {
        return zodValidationError(validation.error);
      }

      const { name, description, definition, status } = validation.data;
      const organizationId = ctx.organizationId;

      if (!definition.nodes.some((n) => n.id === definition.entrypoint)) {
        return validationError("Entrypoint must reference a valid node ID");
      }

      const nodeIds = new Set(definition.nodes.map((n) => n.id));
      for (const edge of definition.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          return validationError(`Edge references invalid node: ${edge.from} -> ${edge.to}`);
        }
      }

      const workflow = await workflowService.create({
        name,
        description,
        organizationId,
        definition,
        createdBy: ctx.userId,
        status,
      });

      await trackFeature({
        userId: ctx.userId,
        featureId: "workflows",
        value: 1,
        idempotencyKey: `workflow-${workflow.id}-${Date.now()}`,
      });

      await trackFeature({
        userId: ctx.userId,
        featureId: "workflows_per_project",
        value: 1,
        idempotencyKey: `workflow-org-${organizationId}-${workflow.id}-${Date.now()}`,
      });

      logger.info("Workflow created", {
        workflowId: workflow.id,
        organizationId,
        userId: ctx.userId,
      });

      return NextResponse.json(workflow, { status: 201 });
    } catch (error: unknown) {
      logger.error("Error creating workflow", {
        error: error instanceof Error ? error.message : String(error),
        route: "/api/workflows",
        method: "POST",
      });
      return internalError();
    }
  },
  { rateLimit: "free" },
);
