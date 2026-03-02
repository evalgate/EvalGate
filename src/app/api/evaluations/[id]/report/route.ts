import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reportCards } from "@/db/schema";
import { internalError, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { reportCardsService } from "@/lib/services/report-cards.service";

const reportBodySchema = z.object({
	evaluationRunId: z.number().int().positive(),
	title: z.string().optional(),
	description: z.string().optional(),
	isPublic: z.boolean().optional(),
});

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext, params) => {
		const { id } = params;
		const evaluationId = parseInt(id, 10);

		let body: z.infer<typeof reportBodySchema>;
		try {
			body = reportBodySchema.parse(await req.json());
		} catch {
			return validationError("evaluationRunId (positive integer) is required");
		}

		try {
			const reportData = await reportCardsService.generateReportCard(
				evaluationId,
				ctx.organizationId,
			);

			const slug = randomUUID().slice(0, 10);
			const now = new Date();
			const [card] = await db
				.insert(reportCards)
				.values({
					evaluationId,
					evaluationRunId: body.evaluationRunId,
					organizationId: ctx.organizationId,
					title: body.title || reportData.evaluationName,
					description:
						body.description || `Report card for ${reportData.evaluationName}`,
					slug,
					reportData: reportData as unknown as import("@/db/types").ReportData,
					isPublic: body.isPublic ?? false,
					createdBy: ctx.userId,
					createdAt: now,
				})
				.returning();

			return NextResponse.json(card, { status: 201 });
		} catch (error: unknown) {
			return internalError(error instanceof Error ? error.message : undefined);
		}
	},
);

export const GET = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		const { id } = params;
		const evaluationId = parseInt(id, 10);

		try {
			const reportData = await reportCardsService.generateReportCard(
				evaluationId,
				ctx.organizationId,
			);
			return NextResponse.json(reportData);
		} catch (error: unknown) {
			return internalError(error instanceof Error ? error.message : undefined);
		}
	},
);
