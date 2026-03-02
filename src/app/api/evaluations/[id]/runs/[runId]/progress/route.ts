import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { evaluationRuns, evaluations } from "@/db/schema";
import { notFound } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		const { id, runId } = params;
		const evaluationId = parseInt(id, 10);
		const evalRunId = parseInt(runId, 10);

		const [run] = await db
			.select()
			.from(evaluationRuns)
			.innerJoin(evaluations, eq(evaluationRuns.evaluationId, evaluations.id))
			.where(
				and(
					eq(evaluationRuns.id, evalRunId),
					eq(evaluations.id, evaluationId),
					eq(evaluations.organizationId, ctx.organizationId),
				),
			)
			.limit(1);

		if (!run) {
			return notFound("Evaluation run not found");
		}

		let heartbeatData: unknown[] = [];
		let lastMessage = "";

		if (run.evaluation_runs.traceLog) {
			try {
				const traceLog = JSON.parse(
					run.evaluation_runs.traceLog as unknown as string,
				);
				heartbeatData = traceLog.heartbeat || [];
				lastMessage =
					(heartbeatData[heartbeatData.length - 1] as { message?: string })
						?.message || "";
			} catch {
				// ignore parse errors
			}
		}

		const totalCases = run.evaluation_runs.totalCases ?? 0;
		const processedCount = run.evaluation_runs.processedCount ?? 0;
		const startedAt = run.evaluation_runs.startedAt ?? "";

		const progress = {
			runId: evalRunId,
			status: run.evaluation_runs.status,
			totalCases,
			processedCount,
			passedCases: run.evaluation_runs.passedCases,
			failedCases: run.evaluation_runs.failedCases,
			startedAt,
			completedAt: run.evaluation_runs.completedAt,
			percentage:
				totalCases > 0 ? Math.round((processedCount / totalCases) * 100) : 0,
			heartbeat: {
				lastMessage,
				count: heartbeatData.length,
				entries: heartbeatData.slice(-5),
			},
			estimatedTimeRemaining:
				processedCount > 0 && totalCases > processedCount && startedAt
					? Math.round(
							(((totalCases - processedCount) / processedCount) *
								(Date.now() - new Date(startedAt).getTime())) /
								1000,
						)
					: null,
		};

		return NextResponse.json(progress);
	},
);
