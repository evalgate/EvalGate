import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	evaluationRuns,
	evaluations,
	testCases,
	testResults,
	user,
} from "@/db/schema";
import { internalError, notFound } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import { updateEvaluationBodySchema } from "@/lib/validation";

export const GET = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		try {
			const { id } = params;

			const evaluationData = await db
				.select({
					evaluation: evaluations,
					creator: {
						id: user.id,
						name: user.name,
						email: user.email,
					},
				})
				.from(evaluations)
				.leftJoin(user, eq(evaluations.createdBy, user.id))
				.where(
					and(
						eq(evaluations.id, parseInt(id, 10)),
						eq(evaluations.organizationId, ctx.organizationId),
					),
				)
				.limit(1);

			if (evaluationData.length === 0) {
				return notFound("Evaluation not found");
			}

			const evalTestCases = await db
				.select()
				.from(testCases)
				.where(eq(testCases.evaluationId, parseInt(id, 10)));

			const formattedEvaluation = {
				...evaluationData[0].evaluation,
				test_cases: evalTestCases,
				users: evaluationData[0].creator,
			};

			return NextResponse.json({ evaluation: formattedEvaluation });
		} catch (error) {
			logger.error("Failed to fetch evaluation", {
				error,
				route: "/api/evaluations/[id]",
				method: "GET",
			});
			return internalError("Internal server error");
		}
	},
);

export const PATCH = secureRoute(
	async (req: NextRequest, ctx: AuthContext, params) => {
		try {
			const { id } = params;

			const parsed = await parseBody(req, updateEvaluationBodySchema);
			if (!parsed.ok) return parsed.response;

			const { name, description } = parsed.data;
			const now = new Date();

			const updated = await db
				.update(evaluations)
				.set({
					name: name !== undefined ? name : undefined,
					description: description !== undefined ? description : undefined,
					updatedAt: now,
				})
				.where(
					and(
						eq(evaluations.id, parseInt(id, 10)),
						eq(evaluations.organizationId, ctx.organizationId),
					),
				)
				.returning();

			if (updated.length === 0) {
				return notFound("Evaluation not found");
			}

			return NextResponse.json({ evaluation: updated[0] });
		} catch (error) {
			logger.error("Failed to update evaluation", {
				error,
				route: "/api/evaluations/[id]",
				method: "PATCH",
			});
			return internalError("Internal server error");
		}
	},
);

export const DELETE = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		try {
			const { id } = params;

			const existing = await db
				.select({ id: evaluations.id })
				.from(evaluations)
				.where(
					and(
						eq(evaluations.id, parseInt(id, 10)),
						eq(evaluations.organizationId, ctx.organizationId),
					),
				)
				.limit(1);

			if (existing.length === 0) {
				return notFound("Evaluation not found");
			}

			const evalId = parseInt(id, 10);

			const runs = await db
				.select({ id: evaluationRuns.id })
				.from(evaluationRuns)
				.where(eq(evaluationRuns.evaluationId, evalId));
			for (const run of runs) {
				await db
					.delete(testResults)
					.where(eq(testResults.evaluationRunId, run.id));
			}
			await db
				.delete(evaluationRuns)
				.where(eq(evaluationRuns.evaluationId, evalId));
			await db.delete(testCases).where(eq(testCases.evaluationId, evalId));
			await db
				.delete(evaluations)
				.where(
					and(
						eq(evaluations.id, evalId),
						eq(evaluations.organizationId, ctx.organizationId),
					),
				);

			return NextResponse.json({ success: true });
		} catch (error) {
			logger.error("Failed to delete evaluation", {
				error,
				route: "/api/evaluations/[id]",
				method: "DELETE",
			});
			return internalError("Internal server error");
		}
	},
);
