import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { benchmarkService } from "@/lib/services/benchmark.service";

const submitResultSchema = z.object({
  agentConfigId: z.number().int().positive(),
  workflowRunId: z.number().int().positive().optional(),
  accuracy: z.number().min(0).max(100).optional(),
  latencyP50: z.number().nonnegative().optional(),
  latencyP95: z.number().nonnegative().optional(),
  totalCost: z.string().optional(),
  successRate: z.number().min(0).max(100).optional(),
  toolUseEfficiency: z.number().min(0).max(100).optional(),
  customMetrics: z.record(z.any()).optional(),
});

/**
 * POST /api/benchmarks/[id]/results - Submit benchmark result
 */
export const POST = secureRoute(
  async (req: NextRequest, ctx: AuthContext, params) => {
    const benchmarkId = parseInt(params.id, 10);

    if (Number.isNaN(benchmarkId)) {
      return validationError("Valid benchmark ID is required");
    }

    const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);
    if (!benchmark) {
      return notFound("Benchmark not found");
    }

    // Verify benchmark belongs to this organization
    if (benchmark.organizationId !== ctx.organizationId) {
      return notFound("Benchmark not found");
    }

    const body = await req.json();

    const validation = submitResultSchema.safeParse(body);
    if (!validation.success) {
      return validationError("Invalid request body", validation.error.errors);
    }

    const result = await benchmarkService.submitResult({
      benchmarkId,
      ...validation.data,
    });

    logger.info("Benchmark result submitted", {
      benchmarkId,
      agentConfigId: validation.data.agentConfigId,
      accuracy: validation.data.accuracy,
      organizationId: ctx.organizationId,
    });

    return NextResponse.json(result, { status: 201 });
  },
  { rateLimit: "free" },
);
