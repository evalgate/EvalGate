import crypto from "node:crypto";
import { db } from "@/db";
import { webhooks } from "@/db/schema";

async function main() {
  const sampleWebhooks = [
    {
      organizationId: 1,
      url: "https://api.example.com/webhooks/traces",
      events: JSON.stringify(["trace.created", "trace.completed"]),
      secret: crypto.randomBytes(32).toString("hex"),
      status: "active",
      lastDeliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organizationId: 1,
      url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX",
      events: JSON.stringify(["evaluation.completed", "evaluation.failed"]),
      secret: crypto.randomBytes(32).toString("hex"),
      status: "active",
      lastDeliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organizationId: 2,
      url: "https://webhook.site/unique-id-1234",
      events: JSON.stringify(["trace.created", "trace.failed", "span.created"]),
      secret: crypto.randomBytes(32).toString("hex"),
      status: "inactive",
      lastDeliveredAt: null,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organizationId: 2,
      url: "https://app.company.com/api/webhooks/evaluations",
      events: JSON.stringify(["evaluation.started", "evaluation.completed"]),
      secret: crypto.randomBytes(32).toString("hex"),
      status: "active",
      lastDeliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  await db.insert(webhooks).values(sampleWebhooks);

  console.log("✅ Webhooks seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
