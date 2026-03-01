import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { internalError, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { guardFeature, trackFeature } from "@/lib/autumn-server";
import { logger } from "@/lib/logger";
import { traceService } from "@/lib/services/trace.service";
import {
	createTraceBodySchema,
	parsePaginationParams,
	sanitizeSearchInput,
} from "@/lib/validation";

export const GET = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		try {
			const { searchParams } = new URL(req.url);
			const { limit, offset } = parsePaginationParams(searchParams);
			const status = searchParams.get("status") ?? undefined;
			const searchRaw = searchParams.get("search");
			const search = searchRaw ? sanitizeSearchInput(searchRaw) : undefined;

			const results = await traceService.list(ctx.organizationId, {
				limit,
				offset,
				status,
				search,
			});

			return NextResponse.json(results, {
				headers: {
					"Cache-Control": "private, max-age=30, stale-while-revalidate=60",
				},
			});
		} catch (error) {
			logger.error("Failed to list traces", {
				error,
				route: "/api/traces",
				method: "GET",
			});
			Sentry.captureException(error);
			return internalError();
		}
	},
	{ rateLimit: "free" },
);

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		const traceGuard = await guardFeature(
			ctx.userId,
			"traces",
			"Traces limit reached. Upgrade your plan to increase quota.",
		);
		if (traceGuard) return traceGuard;

		const orgGuard = await guardFeature(
			ctx.userId,
			"traces_per_project",
			"You've reached your trace limit for this organization. Please upgrade your plan.",
		);
		if (orgGuard) return orgGuard;

		const parsed = await parseBody(req, createTraceBodySchema);
		if (!parsed.ok) return parsed.response;

		try {
			const { name, traceId, status, durationMs, metadata } = parsed.data;

			const newTrace = await traceService.create(ctx.organizationId, {
				name,
				traceId,
				status,
				durationMs: durationMs ?? undefined,
				metadata,
			});

			await trackFeature({
				userId: ctx.userId,
				featureId: "traces",
				value: 1,
				idempotencyKey: `trace-${newTrace[0].id}-${Date.now()}`,
			});

			await trackFeature({
				userId: ctx.userId,
				featureId: "traces_per_project",
				value: 1,
				idempotencyKey: `trace-org-${ctx.organizationId}-${newTrace[0].id}-${Date.now()}`,
			});

			return NextResponse.json(newTrace[0], { status: 201 });
		} catch (error) {
			logger.error("Failed to create trace", {
				error,
				route: "/api/traces",
				method: "POST",
			});
			Sentry.captureException(error);
			return internalError();
		}
	},
	{ rateLimit: "free" },
);

export const DELETE = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		const deleteGuard = await guardFeature(
			ctx.userId,
			"trace_deletion",
			"Trace deletion limit reached. Upgrade your plan to increase quota.",
		);
		if (deleteGuard) return deleteGuard;

		try {
			const { searchParams } = new URL(req.url);
			const id = searchParams.get("id");

			if (!id || Number.isNaN(parseInt(id, 10))) {
				return validationError("Valid ID is required");
			}

			const removed = await traceService.remove(
				ctx.organizationId,
				parseInt(id, 10),
			);

			if (!removed) {
				return notFound("Trace not found");
			}

			return NextResponse.json({ message: "Trace deleted successfully" });
		} catch (error) {
			logger.error("Failed to delete trace", {
				error,
				route: "/api/traces",
				method: "DELETE",
			});
			Sentry.captureException(error);
			return internalError();
		}
	},
	{ rateLimit: "free" },
);
