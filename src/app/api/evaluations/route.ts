import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluations, testCases } from "@/db/schema";
import { internalError, notFound, quotaExceeded, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { checkFeature, trackFeature } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { evaluationService } from "@/lib/services/evaluation.service";
import {
  createEvaluationBodySchema,
  parsePaginationParams,
  putEvaluationBodySchema,
} from "@/lib/validation";

export const GET = secureRoute(
  async (req: NextRequest, ctx: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      const organizationId = ctx.organizationId;

      if (id) {
        const evaluationId = parseInt(id, 10);
        if (Number.isNaN(evaluationId)) {
          return validationError("Valid ID is required");
        }

        const evaluation = await evaluationService.getById(evaluationId, organizationId);

        if (!evaluation) {
          return notFound("Evaluation not found");
        }

        return NextResponse.json(evaluation, {
          headers: {
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
          },
        });
      }

      const { limit, offset } = parsePaginationParams(searchParams);
      const status = searchParams.get("status") as "draft" | "active" | "archived" | null;

      const results = await evaluationService.list(organizationId, {
        limit,
        offset,
        status: status || undefined,
      });

      return NextResponse.json(results, {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      });
    } catch (error: unknown) {
      logger.error("Error fetching evaluations", error, {
        route: "/api/evaluations",
        method: "GET",
      });
      return internalError("Internal server error");
    }
  },
  { rateLimit: "free" },
);

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  const featureCheck = await checkFeature({
    userId: ctx.userId,
    featureId: "projects",
    requiredBalance: 1,
  });

  if (!featureCheck.allowed) {
    return quotaExceeded("Projects limit reached. Upgrade your plan to increase quota.", {
      featureId: "projects",
      remaining: featureCheck.remaining ?? 0,
    });
  }

  const orgLimitCheck = await checkFeature({
    userId: ctx.userId,
    featureId: "evals_per_project",
    requiredBalance: 1,
  });

  if (!orgLimitCheck.allowed) {
    return quotaExceeded(
      "You've reached your evaluation limit for this organization. Please upgrade your plan.",
    );
  }

  const parsed = await parseBody(req, createEvaluationBodySchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const { name, description, type, executionSettings, modelSettings, customMetrics, templates } =
    body;

  try {
    const organizationId = ctx.organizationId;
    const now = new Date();

    const inserted = await db
      .insert(evaluations)
      .values({
        name,
        description,
        type,
        organizationId,
        status: "draft",
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
        executionSettings: executionSettings ? JSON.stringify(executionSettings) : null,
        modelSettings: modelSettings ? JSON.stringify(modelSettings) : null,
        customMetrics: customMetrics ? JSON.stringify(customMetrics) : null,
      })
      .returning();

    const newEvaluation = inserted[0];

    if (newEvaluation) {
      try {
        const allTemplates = (body.config as any)?.templates || (body as any).templates || [];
        const allTestCases: Array<{
          name: string;
          input: string;
          expectedOutput?: string;
          metadata?: unknown;
        }> = [];

        for (const template of allTemplates) {
          const tcs = template.testCases || template.template?.testCases || [];
          for (const tc of tcs) {
            allTestCases.push({
              name: tc.name || tc.label || "Test Case",
              input: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input || ""),
              expectedOutput:
                typeof tc.expectedOutput === "string"
                  ? tc.expectedOutput
                  : JSON.stringify(tc.expectedOutput || ""),
              metadata: tc.metadata ? JSON.stringify(tc.metadata) : null,
            });
          }
        }

        const topLevelCases = body.testCases || [];
        for (const tc of topLevelCases) {
          allTestCases.push({
            name: tc.name || "Test Case",
            input: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input || ""),
            expectedOutput:
              typeof tc.expectedOutput === "string"
                ? tc.expectedOutput
                : JSON.stringify(tc.expectedOutput || ""),
            metadata: tc.metadata ? JSON.stringify(tc.metadata) : null,
          });
        }

        if (allTestCases.length > 0) {
          await db.insert(testCases).values(
            allTestCases.map((tc) => ({
              evaluationId: newEvaluation.id,
              name: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput || null,
              metadata: tc.metadata || null,
              createdAt: now.toISOString(),
            })),
          );
          logger.info("Test cases persisted from templates", {
            evaluationId: newEvaluation.id,
            count: allTestCases.length,
          });
        }
      } catch (tcError) {
        logger.warn("Failed to persist template test cases", {
          error: tcError,
          evaluationId: newEvaluation.id,
        });
      }

      await trackFeature({
        userId: ctx.userId,
        featureId: "evaluation_created",
        value: 1,
        idempotencyKey: `evaluation-${newEvaluation.id}-${Date.now()}`,
      });

      if (organizationId) {
        await trackFeature({
          userId: ctx.userId,
          featureId: "projects",
          value: 1,
          idempotencyKey: `project-${organizationId}-${Date.now()}`,
        });

        await trackFeature({
          userId: ctx.userId,
          featureId: "evals_per_project",
          value: 1,
          idempotencyKey: `eval-org-${organizationId}-${newEvaluation.id}-${Date.now()}`,
        });
      }
    }

    return NextResponse.json(newEvaluation, { status: 201 });
  } catch (error) {
    logger.error({ error, route: "/api/evaluations", method: "POST" }, "Error creating evaluation");
    return internalError("Failed to create evaluation");
  }
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const parsed = await parseBody(req, putEvaluationBodySchema);
    if (!parsed.ok) return parsed.response;

    const updated = await evaluationService.update(
      parseInt(id, 10),
      ctx.organizationId,
      parsed.data,
    );

    if (!updated) {
      return notFound("Evaluation not found");
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("Error updating evaluation", error, {
      route: "/api/evaluations",
      method: "PUT",
    });
    return internalError("Internal server error");
  }
});

export const DELETE = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || Number.isNaN(parseInt(id, 10))) {
      return validationError("Valid ID is required");
    }

    const deleted = await evaluationService.delete(parseInt(id, 10), ctx.organizationId);

    if (!deleted) {
      return notFound("Evaluation not found");
    }

    return NextResponse.json({
      message: "Evaluation deleted successfully",
      success: true,
    });
  } catch (error: unknown) {
    logger.error("Error deleting evaluation", error, {
      route: "/api/evaluations",
      method: "DELETE",
    });
    return internalError("Internal server error");
  }
});
