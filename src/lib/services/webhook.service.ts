/**
 * Webhook Service Layer
 * Handles webhook delivery with HMAC-SHA256 request signing
 */

import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { enqueue } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/logger";
import {
	decryptWebhookSecret,
	encryptWebhookSecret,
} from "@/lib/security/webhook-secrets";

export const createWebhookSchema = z.object({
	url: z.string().url(),
	events: z.array(z.string()).min(1),
	secret: z.string().optional(),
	description: z.string().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export interface WebhookPayload {
	event: string;
	data: unknown;
	timestamp: string;
	organizationId: number;
}

export class WebhookService {
	/**
	 * List webhooks for an organization
	 */
	async list(organizationId: number) {
		logger.info("Listing webhooks", { organizationId });

		const results = await db
			.select()
			.from(webhooks)
			.where(eq(webhooks.organizationId, organizationId))
			.orderBy(desc(webhooks.createdAt));

		logger.info("Webhooks listed", { count: results.length, organizationId });

		return results;
	}

	/**
	 * Get webhook by ID
	 */
	async getById(id: number, organizationId: number) {
		logger.info("Getting webhook by ID", { id, organizationId });

		const results = await db
			.select()
			.from(webhooks)
			.where(
				and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)),
			)
			.limit(1);

		if (results.length === 0) {
			logger.warn("Webhook not found", { id, organizationId });
			return null;
		}

		return results[0];
	}

	/**
	 * Create a new webhook
	 */
	async create(organizationId: number, data: CreateWebhookInput) {
		logger.info("Creating webhook", { organizationId, url: data.url });

		// Generate secret if not provided
		const secret = data.secret || this.generateSecret();

		const encryptedSecret = encryptWebhookSecret(organizationId, secret);

		const [webhook] = await db
			.insert(webhooks)
			.values({
				organizationId,
				url: data.url,
				events: data.events as import("@/db/types").WebhookEvents,
				secret: encryptedSecret.secretPlaceholder,
				encryptedSecret: encryptedSecret.encryptedSecret,
				secretIv: encryptedSecret.secretIv,
				secretTag: encryptedSecret.secretTag,
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		logger.info("Webhook created", { id: webhook.id, organizationId });

		return webhook;
	}

	/**
	 * Update a webhook
	 */
	async update(
		id: number,
		organizationId: number,
		data: Partial<CreateWebhookInput>,
	) {
		logger.info("Updating webhook", { id, organizationId });

		const existing = await this.getById(id, organizationId);
		if (!existing) {
			logger.warn("Webhook not found for update", { id, organizationId });
			return null;
		}

		const updateData: {
			updatedAt: Date;
			url?: string;
			events?: string[];
			secret?: string;
			encryptedSecret?: string;
			secretIv?: string;
			secretTag?: string;
		} = {
			updatedAt: new Date(),
		};
		if (data.url) updateData.url = data.url;
		if (data.events) updateData.events = data.events;
		if (data.secret) {
			const encryptedSecret = encryptWebhookSecret(organizationId, data.secret);
			updateData.secret = encryptedSecret.secretPlaceholder;
			updateData.encryptedSecret = encryptedSecret.encryptedSecret;
			updateData.secretIv = encryptedSecret.secretIv;
			updateData.secretTag = encryptedSecret.secretTag;
		}

		const [updated] = await db
			.update(webhooks)
			.set(updateData)
			.where(
				and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)),
			)
			.returning();

		logger.info("Webhook updated", { id, organizationId });

		return updated;
	}

	/**
	 * Delete a webhook
	 */
	async delete(id: number, organizationId: number) {
		logger.info("Deleting webhook", { id, organizationId });

		const existing = await this.getById(id, organizationId);
		if (!existing) {
			logger.warn("Webhook not found for deletion", { id, organizationId });
			return false;
		}

		await db
			.delete(webhooks)
			.where(
				and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)),
			);

		logger.info("Webhook deleted", { id, organizationId });

		return true;
	}

	/**
	 * Deliver webhook payload
	 */
	async deliver(
		webhookId: number,
		organizationId: number,
		payload: WebhookPayload,
	) {
		logger.info("Delivering webhook", {
			webhookId,
			organizationId,
			event: payload.event,
		});

		const webhook = await this.getById(webhookId, organizationId);
		if (!webhook) {
			logger.error("Webhook not found for delivery", {
				webhookId,
				organizationId,
			});
			throw new Error("Webhook not found");
		}

		if (webhook.status !== "active") {
			logger.warn("Webhook is not active", {
				webhookId,
				status: webhook.status,
			});
			return null;
		}

		// Check if webhook is subscribed to this event
		const events = Array.isArray(webhook.events) ? webhook.events : [];
		if (!events.includes(payload.event)) {
			logger.debug("Webhook not subscribed to event", {
				webhookId,
				event: payload.event,
			});
			return null;
		}

		const payloadString = JSON.stringify(payload);
		const secret = decryptWebhookSecret(organizationId, {
			encryptedSecret: webhook.encryptedSecret,
			secretIv: webhook.secretIv,
			secretTag: webhook.secretTag,
			secret: webhook.secret,
		});
		if (!secret) {
			throw new Error("Webhook secret not available");
		}
		const signature = this.signPayload(payloadString, secret);

		const startTime = Date.now();
		let status: "success" | "failed" = "failed";
		let responseCode: number | null = null;
		let responseBody = "";
		let error: string | null = null;

		try {
			const response = await fetch(webhook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Webhook-Signature": signature,
					"X-Webhook-Event": payload.event,
					"X-Webhook-Timestamp": payload.timestamp,
					"User-Agent": "EvalAI-Webhooks/1.0",
				},
				body: payloadString,
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			responseCode = response.status;
			responseBody = await response.text();

			if (response.ok) {
				status = "success";
				logger.info("Webhook delivered successfully", {
					webhookId,
					status: responseCode,
					duration: Date.now() - startTime,
				});
			} else {
				error = `HTTP ${responseCode}: ${responseBody.substring(0, 500)}`;
				logger.warn("Webhook delivery failed", {
					webhookId,
					status: responseCode,
					error,
				});
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			error = errorMessage;
			logger.error("Webhook delivery error", {
				webhookId,
				error: errorMessage,
				stack: err instanceof Error ? err.stack : undefined,
			});
		}

		// Record delivery attempt
		const [delivery] = await db
			.insert(webhookDeliveries)
			.values({
				webhookId,
				eventType: payload.event,
				payload: payload as unknown as import("@/db/types").WebhookPayload,
				status,
				responseStatus: responseCode || null,
				responseBody: error ? `Error: ${error}` : responseBody,
				attemptCount: 1,
				createdAt: new Date(),
			})
			.returning();

		return delivery;
	}

	/**
	 * Get webhook deliveries
	 */
	async getDeliveries(
		webhookId: number,
		organizationId: number,
		options?: {
			limit?: number;
			offset?: number;
		},
	) {
		const limit = options?.limit || 50;
		const offset = options?.offset || 0;

		logger.info("Getting webhook deliveries", {
			webhookId,
			organizationId,
			limit,
			offset,
		});

		// Verify webhook ownership
		const webhook = await this.getById(webhookId, organizationId);
		if (!webhook) {
			return null;
		}

		const deliveries = await db
			.select()
			.from(webhookDeliveries)
			.where(eq(webhookDeliveries.webhookId, webhookId))
			.limit(limit)
			.offset(offset)
			.orderBy(desc(webhookDeliveries.createdAt));

		logger.info("Webhook deliveries retrieved", { count: deliveries.length });

		return deliveries;
	}

	/**
	 * Generate webhook secret
	 * @private
	 */
	private generateSecret(): string {
		return crypto.randomBytes(32).toString("hex");
	}

	/**
	 * Sign webhook payload with HMAC-SHA256
	 * @private
	 */
	private signPayload(payload: string, secret: string): string {
		const hmac = crypto.createHmac("sha256", secret);
		hmac.update(payload);
		return `sha256=${hmac.digest("hex")}`;
	}

	/**
	 * Verify webhook signature
	 */
	verifySignature(payload: string, signature: string, secret: string): boolean {
		const expectedSignature = this.signPayload(payload, secret);

		// Use constant-time comparison to prevent timing attacks
		try {
			return crypto.timingSafeEqual(
				Buffer.from(signature),
				Buffer.from(expectedSignature),
			);
		} catch {
			return false;
		}
	}

	/**
	 * Trigger webhook for event — enqueues async delivery jobs (non-blocking).
	 *
	 * Each subscribed webhook gets its own job with retry/backoff semantics.
	 * Returns immediately with the count of enqueued jobs.
	 */
	async trigger(organizationId: number, event: string, data: unknown) {
		logger.info("Triggering webhooks for event", { organizationId, event });

		const activeWebhooks = await db
			.select()
			.from(webhooks)
			.where(
				and(
					eq(webhooks.organizationId, organizationId),
					eq(webhooks.status, "active"),
				),
			);

		const subscribedWebhooks = activeWebhooks.filter((w) => {
			const events = Array.isArray(w.events) ? w.events : [];
			return events.includes(event);
		});

		logger.info("Found subscribed webhooks", {
			count: subscribedWebhooks.length,
			event,
			organizationId,
		});

		const timestamp = new Date().toISOString();

		for (const webhook of subscribedWebhooks) {
			await enqueue(
				"webhook_delivery",
				{ webhookId: webhook.id, organizationId, event, data, timestamp },
				{ organizationId },
			);
		}

		logger.info("Webhook delivery jobs enqueued", {
			enqueued: subscribedWebhooks.length,
			event,
			organizationId,
		});

		return { enqueued: subscribedWebhooks.length };
	}
}

// Export singleton instance
export const webhookService = new WebhookService();
