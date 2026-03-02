import crypto from "node:crypto";
import { db } from "@/db";
import { webhooks } from "@/db/schema";

async function main() {
	const sampleWebhooks = [
		{
			organizationId: 1,
			url: "https://api.example.com/webhooks/traces",
			events: [
				"trace.created",
				"trace.completed",
			] as import("@/db/types").WebhookEvents,
			secret: crypto.randomBytes(32).toString("hex"),
			status: "active",
			lastDeliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
			createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
			updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
		},
		{
			organizationId: 1,
			url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX",
			events: [
				"evaluation.completed",
				"evaluation.failed",
			] as import("@/db/types").WebhookEvents,
			secret: crypto.randomBytes(32).toString("hex"),
			status: "active",
			lastDeliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
			createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
			updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
		},
		{
			organizationId: 2,
			url: "https://webhook.site/unique-id-1234",
			events: [
				"trace.created",
				"trace.failed",
				"span.created",
			] as import("@/db/types").WebhookEvents,
			secret: crypto.randomBytes(32).toString("hex"),
			status: "inactive",
			lastDeliveredAt: null,
			createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
			updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
		},
		{
			organizationId: 2,
			url: "https://app.compunknown.com/api/webhooks/evaluations",
			events: [
				"evaluation.started",
				"evaluation.completed",
			] as import("@/db/types").WebhookEvents,
			secret: crypto.randomBytes(32).toString("hex"),
			status: "active",
			lastDeliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
			createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
			updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
		},
	];

	await db.insert(webhooks).values(sampleWebhooks);

	console.log("✅ Webhooks seeder completed successfully");
}

main().catch((error) => {
	console.error("❌ Seeder failed:", error);
});
