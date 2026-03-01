import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { internalError, zodValidationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { guardFeature, trackFeature } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { benchmarkService } from "@/lib/services/benchmark.service";

const createBenchmarkSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	organizationId: z.number().int().positive(),
	taskType: z.enum(["qa", "coding", "reasoning", "tool_use", "multi_step"]),
	dataset: z
		.array(
			z.object({
				input: z.string(),
				expectedOutput: z.string().optional(),
				metadata: z.record(z.unknown()).optional(),
			}),
		)
		.optional(),
	metrics: z.array(z.string()),
	isPublic: z.boolean().optional(),
});

export const GET = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		try {
			const { searchParams } = new URL(req.url);
			const includePublic = searchParams.get("includePublic") !== "false";

			const benchmarks = await benchmarkService.listBenchmarks(
				ctx.organizationId,
				includePublic,
			);

			return NextResponse.json(benchmarks, {
				headers: {
					"Cache-Control": "private, max-age=60",
				},
			});
		} catch (error: unknown) {
			logger.error("Error listing benchmarks", {
				error: error instanceof Error ? error.message : String(error),
				route: "/api/benchmarks",
				method: "GET",
			});
			return internalError();
		}
	},
	{ rateLimit: "free" },
);

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		const benchmarkGuard = await guardFeature(
			ctx.userId,
			"benchmarks",
			"Benchmarks limit reached. Upgrade your plan to increase quota.",
		);
		if (benchmarkGuard) return benchmarkGuard;

		try {
			const body = await req.json();

			const validation = createBenchmarkSchema.safeParse(body);
			if (!validation.success) {
				return zodValidationError(validation.error);
			}

			const benchmark = await benchmarkService.createBenchmark({
				...validation.data,
				createdBy: ctx.userId,
			});

			await trackFeature({
				userId: ctx.userId,
				featureId: "benchmarks",
				value: 1,
				idempotencyKey: `benchmark-${benchmark.id}-${Date.now()}`,
			});

			logger.info("Benchmark created", {
				benchmarkId: benchmark.id,
				taskType: benchmark.taskType,
			});

			return NextResponse.json(benchmark, { status: 201 });
		} catch (error: unknown) {
			logger.error("Error creating benchmark", {
				error: error instanceof Error ? error.message : String(error),
				route: "/api/benchmarks",
				method: "POST",
			});
			return internalError();
		}
	},
	{ rateLimit: "free" },
);
