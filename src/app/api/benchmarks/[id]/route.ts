import { type NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { benchmarkService } from "@/lib/services/benchmark.service";

/**
 * GET /api/benchmarks/[id] - Get a single benchmark
 */
export const GET = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const benchmarkId = parseInt(params.id, 10);

  if (Number.isNaN(benchmarkId)) {
    return validationError("Valid benchmark ID is required");
  }

  const benchmark = await benchmarkService.getBenchmarkById(benchmarkId);

  if (!benchmark) {
    return notFound("Benchmark not found");
  }

  // Verify org ownership
  if (benchmark.organizationId !== ctx.organizationId) {
    return forbidden("Benchmark does not belong to your organization");
  }

  const stats = await benchmarkService.getBenchmarkStats(benchmarkId);

  return NextResponse.json({
    benchmark,
    stats,
  });
});

/**
 * DELETE /api/benchmarks/[id] - Delete a benchmark
 */
export const DELETE = secureRoute(async (_req: NextRequest, ctx: AuthContext, params) => {
  const benchmarkId = parseInt(params.id, 10);

  if (Number.isNaN(benchmarkId)) {
    return validationError("Valid benchmark ID is required");
  }

  // Use ctx.organizationId instead of query param
  const deleted = await benchmarkService.deleteBenchmark(benchmarkId, ctx.organizationId);

  if (!deleted) {
    return notFound("Benchmark not found or access denied");
  }

  return NextResponse.json({
    message: "Benchmark deleted successfully",
    success: true,
  });
});
