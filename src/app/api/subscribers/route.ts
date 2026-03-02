/**
 * Email Subscribers API
 * Handles email capture from playground, homepage, and other sources
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { emailSubscribers } from "@/db/schema";
import {
	internalError,
	notFound,
	validationError,
	zodValidationError,
} from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api-rate-limit";
import { logger } from "@/lib/logger";

const subscribeSchema = z.object({
	email: z.string().email("Invalid email address"),
	source: z.string().min(1, "Source is required"),
	context: z.record(z.unknown()).optional(),
	subscribedAt: z.string().optional(),
});

/**
 * POST /api/subscribers
 * Subscribe a new email address
 */
export async function POST(request: NextRequest) {
	return withRateLimit(
		request,
		async () => {
			try {
				const body = await request.json();

				// Validate input
				const validated = subscribeSchema.parse(body);
				const { email, source, context = {} } = validated;

				// Check if already subscribed
				const existing = await db
					.select()
					.from(emailSubscribers)
					.where(eq(emailSubscribers.email, email))
					.limit(1);

				if (existing.length > 0) {
					const subscriber = existing[0];

					// If they previously unsubscribed, re-subscribe them
					if (subscriber.status === "unsubscribed") {
						await db
							.update(emailSubscribers)
							.set({
								status: "active",
								source, // Update source
								context: context as import("@/db/types").SubscriberContext,
								subscribedAt: new Date(),
								unsubscribedAt: null,
								updatedAt: new Date(),
							})
							.where(eq(emailSubscribers.email, email));

						logger.info("Email re-subscribed", { email, source });

						return NextResponse.json({
							success: true,
							message: "Welcome back! You have been re-subscribed.",
							subscriber: { email, status: "active" },
						});
					}

					// Already active subscriber
					return NextResponse.json({
						success: true,
						message: "You are already subscribed!",
						subscriber: { email, status: subscriber.status },
					});
				}

				// Determine tags based on source and context
				const tags = generateTags(source, context);

				// Create new subscriber
				const now = new Date();
				const [newSubscriber] = await db
					.insert(emailSubscribers)
					.values({
						email,
						source,
						context: context as import("@/db/types").SubscriberContext,
						status: "active",
						tags: tags as import("@/db/types").SubscriberTags,
						subscribedAt: now,
						unsubscribedAt: null,
						lastEmailSentAt: null,
						emailCount: 0,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				logger.info("New email subscriber", { email, source, tags });

				// TODO: Integrate with email service (Resend, SendGrid, etc.)
				// - Send welcome email with evaluation results
				// - Add to nurture sequence
				// - Notify team in Slack

				return NextResponse.json(
					{
						success: true,
						message: "Successfully subscribed! Check your email.",
						subscriber: {
							email: newSubscriber.email,
							status: newSubscriber.status,
							tags,
						},
					},
					{ status: 201 },
				);
			} catch (error: unknown) {
				logger.error("Failed to subscribe email", {
					error: error instanceof Error ? error.message : String(error),
				});

				if (error instanceof z.ZodError) {
					return zodValidationError(error);
				}

				return internalError("Failed to subscribe. Please try again.");
			}
		},
		{ customTier: "anonymous" },
	);
}

/**
 * DELETE /api/subscribers?email=xxx
 * Unsubscribe an email address
 */
export async function DELETE(request: NextRequest) {
	return withRateLimit(
		request,
		async () => {
			try {
				const email = request.nextUrl.searchParams.get("email");

				if (!email) {
					return validationError("Email parameter is required");
				}

				// Find subscriber
				const existing = await db
					.select()
					.from(emailSubscribers)
					.where(eq(emailSubscribers.email, email))
					.limit(1);

				if (existing.length === 0) {
					return notFound("Email not found");
				}

				// Update status to unsubscribed
				await db
					.update(emailSubscribers)
					.set({
						status: "unsubscribed",
						unsubscribedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(emailSubscribers.email, email));

				logger.info("Email unsubscribed", { email });

				return NextResponse.json({
					success: true,
					message: "Successfully unsubscribed",
				});
			} catch (error: unknown) {
				logger.error("Failed to unsubscribe email", {
					error: error instanceof Error ? error.message : String(error),
				});

				return internalError("Failed to unsubscribe. Please try again.");
			}
		},
		{ customTier: "anonymous" },
	);
}

/**
 * Generate tags based on source and context
 */
function generateTags(
	source: string,
	context: Record<string, unknown>,
): string[] {
	const tags: string[] = [];

	// Source tags
	tags.push(`source:${source}`);

	// Context-based tags
	if (source === "playground") {
		tags.push("playground-lead");
		tags.push("high-intent");

		if (context.scenario) {
			tags.push(`scenario:${context.scenario}`);
		}

		if (context.score && (context.score as number) > 80) {
			tags.push("impressed-by-results");
		}

		if (context.testsPassed && (context.testsPassed as number) > 5) {
			tags.push("engaged-user");
		}
	}

	if (source === "homepage") {
		tags.push("homepage-lead");
	}

	if (source === "blog") {
		tags.push("content-reader");
	}

	if (source === "templates") {
		tags.push("template-user");
		tags.push("developer");
	}

	return tags;
}
