import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { forbidden, notFound, validationError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parse";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { encryptWebhookSecret } from "@/lib/security/webhook-secrets";
import { updateWebhookBodySchema } from "@/lib/validation";

type LoadWebhookResult =
	| { error: NextResponse }
	| { webhook: typeof webhooks.$inferSelect };

/**
 * Fetch the webhook and verify it belongs to the caller's org.
 * Returns the webhook row or a NextResponse error.
 */
async function loadOwnedWebhook(
	webhookId: number,
	ctx: AuthContext,
): Promise<LoadWebhookResult> {
	const result = await db
		.select()
		.from(webhooks)
		.where(eq(webhooks.id, webhookId))
		.limit(1);

	if (result.length === 0) {
		return { error: notFound("Webhook not found") };
	}
	if (result[0].organizationId !== ctx.organizationId) {
		return { error: forbidden("Webhook does not belong to your organization") };
	}
	return { webhook: result[0] };
}

export const GET = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		const webhookId = parseInt(params.id, 10);
		if (Number.isNaN(webhookId)) {
			return validationError("Valid ID is required");
		}

		const result = await loadOwnedWebhook(webhookId, ctx);
		if ("error" in result) return result.error;

		const {
			secret,
			encryptedSecret,
			secretIv,
			secretTag,
			...webhookWithoutSecret
		} = result.webhook;
		return NextResponse.json(webhookWithoutSecret, { status: 200 });
	},
);

export const PATCH = secureRoute(
	async (req: NextRequest, ctx: AuthContext, params) => {
		const webhookId = parseInt(params.id, 10);
		if (Number.isNaN(webhookId)) {
			return validationError("Valid ID is required");
		}

		const result = await loadOwnedWebhook(webhookId, ctx);
		if ("error" in result) return result.error;

		const parsed = await parseBody(req, updateWebhookBodySchema);
		if (!parsed.ok) return parsed.response;

		const { url, events, status, secret } = parsed.data;

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (url !== undefined) {
			updates.url = url;
		}

		if (events !== undefined) {
			updates.events = JSON.stringify(events);
		}

		if (status !== undefined) {
			updates.status = status;
		}

		if (secret !== undefined) {
			const encryptedSecret = encryptWebhookSecret(ctx.organizationId, secret);
			updates.secret = encryptedSecret.secretPlaceholder;
			updates.encryptedSecret = encryptedSecret.encryptedSecret;
			updates.secretIv = encryptedSecret.secretIv;
			updates.secretTag = encryptedSecret.secretTag;
		}

		const updated = await db
			.update(webhooks)
			.set(updates)
			.where(eq(webhooks.id, webhookId))
			.returning();

		if (updated.length === 0) {
			return notFound("Webhook not found");
		}

		const {
			secret: _secret,
			encryptedSecret: _enc,
			secretIv: _iv,
			secretTag: _tag,
			...webhookWithoutSecret
		} = updated[0];
		return NextResponse.json(webhookWithoutSecret, { status: 200 });
	},
	{ routeRisk: "sensitive" },
);

export const DELETE = secureRoute(
	async (_req: NextRequest, ctx: AuthContext, params) => {
		const webhookId = parseInt(params.id, 10);
		if (Number.isNaN(webhookId)) {
			return validationError("Valid ID is required");
		}

		const result = await loadOwnedWebhook(webhookId, ctx);
		if ("error" in result) return result.error;

		const deleted = await db
			.delete(webhooks)
			.where(eq(webhooks.id, webhookId))
			.returning();

		if (deleted.length === 0) {
			return notFound("Webhook not found");
		}

		const {
			secret: _secret,
			encryptedSecret: _encryptedSecret,
			secretIv: _secretIv,
			secretTag: _secretTag,
			...deletedWithoutSecret
		} = deleted[0];
		return NextResponse.json(
			{
				message: "Webhook deleted successfully",
				deletedWebhook: deletedWithoutSecret,
			},
			{ status: 200 },
		);
	},
	{ routeRisk: "sensitive" },
);
