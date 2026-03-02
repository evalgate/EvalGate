import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluations, testCases } from "@/db/schema";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { guardFeature, trackFeature } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { evaluationService } from "@/lib/services/evaluation.service";
import {
	createEvaluationBodySchema,
	parseIdParam,
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
				const evaluationId = parseIdParam(id);
				if (!evaluationId) {
					return validationError("Valid ID is required");
				}

				const evaluation = await evaluationService.getById(
					evaluationId,
					organizationId,
				);

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
			const status = searchParams.get("status") as
				| "draft"
				| "active"
				| "archived"
				| null;

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
			Sentry.captureException(error);
			return internalError("Internal server error");
		}
	},
	{ rateLimit: "free" },
);

export const POST = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
	const projectGuard = await guardFeature(
		ctx.userId,
		"projects",
		"Projects limit reached. Upgrade your plan to increase quota.",
	);
	if (projectGuard) return projectGuard;

	const orgGuard = await guardFeature(
		ctx.userId,
		"evals_per_project",
		"You've reached your evaluation limit for this organization. Please upgrade your plan.",
	);
	if (orgGuard) return orgGuard;

	const parsed = await parseBody(req, createEvaluationBodySchema);
	if (!parsed.ok) return parsed.response;

	const body = parsed.data;
	const {
		name,
		description,
		type,
		executionSettings,
		modelSettings,
		customMetrics,
	} = body;

	try {
		const organizationId = ctx.organizationId;
		const now = new Date();

		const inserted = await db
			.insert(evaluations)
			.values({
				name: name ?? "",
				description: description ?? null,
				type: type ?? "",
				organizationId,
				status: "draft",
				createdBy: ctx.userId,
				createdAt: now,
				updatedAt: now,
				executionSettings:
					(executionSettings as import("@/db/types").ExecutionSettings) ?? null,
				modelSettings:
					(modelSettings as import("@/db/types").ModelSettings) ?? null,
				customMetrics:
					(customMetrics as import("@/db/types").CustomMetrics) ?? null,
			})
			.returning();

		const newEvaluation = inserted[0];

		if (newEvaluation) {
			try {
				const allTemplates: unknown[] = ((
					body.config as Record<string, unknown> | undefined
				)?.templates ||
					(body as Record<string, unknown>).templates ||
					[]) as unknown[];
				const allTestCases: Array<{
					name: string;
					input: string;
					expectedOutput?: string;
					metadata?: unknown;
				}> = [];

				for (const template of allTemplates) {
					const t = template as Record<string, unknown>;
					const tcs = (t.testCases ||
						(t.template as Record<string, unknown> | undefined)?.testCases ||
						[]) as Array<Record<string, unknown>>;
					for (const tc of tcs) {
						allTestCases.push({
							name: (tc.name || tc.label || "Test Case") as string,
							input:
								typeof tc.input === "string"
									? tc.input
									: JSON.stringify(tc.input || ""),
							expectedOutput:
								typeof tc.expectedOutput === "string"
									? tc.expectedOutput
									: JSON.stringify(tc.expectedOutput || ""),
							metadata: tc.metadata ?? null,
						});
					}
				}

				const topLevelCases = (body.testCases || []) as Array<
					Record<string, unknown>
				>;
				for (const tc of topLevelCases) {
					allTestCases.push({
						name: (tc.name as string) || "Test Case",
						input:
							typeof tc.input === "string"
								? tc.input
								: JSON.stringify(tc.input || ""),
						expectedOutput:
							typeof tc.expectedOutput === "string"
								? tc.expectedOutput
								: JSON.stringify(tc.expectedOutput || ""),
						metadata: tc.metadata ?? null,
					});
				}

				if (allTestCases.length > 0) {
					await db.insert(testCases).values(
						allTestCases.map((tc) => ({
							evaluationId: newEvaluation.id,
							name: tc.name,
							input: tc.input,
							expectedOutput: tc.expectedOutput || null,
							metadata:
								(tc.metadata as import("@/db/types").TestCaseMetadata) ?? null,
							createdAt: now,
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
		logger.error("Error creating evaluation", {
			error,
			route: "/api/evaluations",
			method: "POST",
		});
		Sentry.captureException(error);
		return internalError("Failed to create evaluation");
	}
});

export const PUT = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get("id");
		const evaluationId = parseIdParam(id);
		if (!evaluationId) {
			return validationError("Valid ID is required");
		}

		const parsed = await parseBody(req, putEvaluationBodySchema);
		if (!parsed.ok) return parsed.response;

		const updated = await evaluationService.update(
			evaluationId,
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
		Sentry.captureException(error);
		return internalError("Internal server error");
	}
});

export const DELETE = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		try {
			const { searchParams } = new URL(req.url);
			const id = searchParams.get("id");
			const evaluationId = parseIdParam(id);
			if (!evaluationId) {
				return validationError("Valid ID is required");
			}

			const deleted = await evaluationService.delete(
				evaluationId,
				ctx.organizationId,
			);

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
			Sentry.captureException(error);
			return internalError("Internal server error");
		}
	},
);
