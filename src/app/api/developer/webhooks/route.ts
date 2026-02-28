import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { forbidden, internalError, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { encryptWebhookSecret } from "@/lib/security/webhook-secrets";
import {
	createWebhookBodySchema,
	parsePaginationParams,
} from "@/lib/validation";

export const POST = secureRoute(
	async (req: NextRequest, ctx: AuthContext) => {
		const parsed = await parseBody(req, createWebhookBodySchema);
		if (!parsed.ok) return parsed.response;

		const { organizationId, url, events } = parsed.data;

		if (organizationId !== ctx.organizationId) {
			return forbidden("Organization ID must match your current organization");
		}

		try {
			const trimmedUrl = url.trim();
			const secret = crypto.randomBytes(32).toString("hex");
			const encryptedSecret = encryptWebhookSecret(ctx.organizationId, secret);

			const now = new Date();
			const newWebhook = await db
				.insert(webhooks)
				.values({
					organizationId: ctx.organizationId,
					url: trimmedUrl,
					events: JSON.stringify(events),
					secret: encryptedSecret.secretPlaceholder,
					encryptedSecret: encryptedSecret.encryptedSecret,
					secretIv: encryptedSecret.secretIv,
					secretTag: encryptedSecret.secretTag,
					status: "active",
					lastDeliveredAt: null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			if (newWebhook.length === 0) {
				return internalError("Failed to create webhook");
			}

			const created = newWebhook[0];
			return NextResponse.json(
				{
					id: created.id,
					url: created.url,
					events:
						typeof created.events === "string"
							? JSON.parse(created.events)
							: created.events,
					secret,
					status: created.status,
					createdAt: created.createdAt,
				},
				{ status: 201 },
			);
		} catch (_error: unknown) {
			return internalError();
		}
	},
	{ routeRisk: "sensitive" },
);

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
	try {
		const { searchParams } = new URL(req.url);
		const organizationIdParam = searchParams.get("organizationId");
		const statusParam = searchParams.get("status");
		const { limit, offset } = parsePaginationParams(searchParams);

		if (!organizationIdParam) {
			return validationError("Organization ID is required");
		}

		const organizationId = parseInt(organizationIdParam, 10);
		if (Number.isNaN(organizationId)) {
			return validationError("Valid organization ID is required");
		}

		if (organizationId !== ctx.organizationId) {
			return forbidden("Organization ID must match your current organization");
		}

		const conditions = [eq(webhooks.organizationId, organizationId)];

		if (statusParam) {
			if (statusParam !== "active" && statusParam !== "inactive") {
				return validationError('Status must be "active" or "inactive"');
			}
			conditions.push(eq(webhooks.status, statusParam));
		}

		const whereCondition =
			conditions.length > 1 ? and(...conditions) : conditions[0];

		const results = await db
			.select({
				id: webhooks.id,
				organizationId: webhooks.organizationId,
				url: webhooks.url,
				events: webhooks.events,
				status: webhooks.status,
				lastDeliveredAt: webhooks.lastDeliveredAt,
				createdAt: webhooks.createdAt,
				updatedAt: webhooks.updatedAt,
			})
			.from(webhooks)
			.where(whereCondition)
			.orderBy(desc(webhooks.createdAt))
			.limit(limit)
			.offset(offset);

		const webhooksWithParsedEvents = results.map((webhook) => ({
			id: webhook.id,
			organizationId: webhook.organizationId,
			url: webhook.url,
			events:
				typeof webhook.events === "string"
					? JSON.parse(webhook.events)
					: webhook.events,
			status: webhook.status,
			lastDeliveredAt: webhook.lastDeliveredAt,
			createdAt: webhook.createdAt,
			updatedAt: webhook.updatedAt,
		}));

		return NextResponse.json(webhooksWithParsedEvents, { status: 200 });
	} catch (_error: unknown) {
		return internalError();
	}
});
