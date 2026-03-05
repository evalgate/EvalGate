/**
 * POST /api/traces/:id/feedback — Submit user feedback on a trace.
 *
 * Thumbs-down feedback triggers a trace_failure_analysis job enqueue.
 */

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { traces, userFeedback } from "@/db/schema";
import { notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { SCOPES } from "@/lib/auth/scopes";
import { enqueue } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/logger";

const feedbackBodySchema = z.object({
	feedback_type: z.enum(["thumbs_up", "thumbs_down", "rating", "comment"]),
	value: z.record(z.unknown()).optional(),
	user_id_external: z.string().optional(),
});

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext, params) => {
		const traceDbId = parseInt(params.id, 10);
		if (Number.isNaN(traceDbId))
			return validationError("Valid trace ID required");

		const parsed = await parseBody(req, feedbackBodySchema);
		if (!parsed.ok) return parsed.response;

		// Verify trace exists and belongs to org
		const [trace] = await db
			.select({ id: traces.id })
			.from(traces)
			.where(
				and(
					eq(traces.id, traceDbId),
					eq(traces.organizationId, ctx.organizationId),
				),
			)
			.limit(1);

		if (!trace) return notFound("Trace not found");

		// Insert feedback
		const [row] = await db
			.insert(userFeedback)
			.values({
				organizationId: ctx.organizationId,
				traceId: traceDbId,
				feedbackType: parsed.data.feedback_type,
				value: parsed.data.value ?? null,
				userIdExternal: parsed.data.user_id_external ?? null,
				createdAt: new Date(),
			})
			.returning();

		// Thumbs-down triggers failure analysis
		let queuedForAnalysis = false;
		if (parsed.data.feedback_type === "thumbs_down") {
			await enqueue(
				"trace_failure_analysis",
				{
					traceDbId,
					organizationId: ctx.organizationId,
				},
				{
					organizationId: ctx.organizationId,
					idempotencyKey: `feedback_analysis_${traceDbId}`,
				},
			);
			queuedForAnalysis = true;
			logger.info("Feedback triggered failure analysis", {
				traceDbId,
				feedbackType: parsed.data.feedback_type,
			});
		}

		return NextResponse.json(
			{
				id: row?.id,
				feedback_type: parsed.data.feedback_type,
				queued_for_analysis: queuedForAnalysis,
			},
			{ status: 201 },
		);
	},
	{ requiredScopes: [SCOPES.TRACES_WRITE] },
);
