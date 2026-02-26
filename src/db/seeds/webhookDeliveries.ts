import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";

async function main() {
  const existingWebhooks = await db.select().from(webhooks);

  if (existingWebhooks.length === 0) {
    console.error("❌ No webhooks found. Please seed webhooks table first.");
    return;
  }

  const webhookIds = existingWebhooks.map((w) => w.id);

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const getRandomDate = (isPending: boolean = false): Date => {
    const start = isPending ? new Date(now.getTime() - 2 * 60 * 60 * 1000) : fiveDaysAgo;
    const end = now;
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  const sampleDeliveries = [
    {
      webhookId: webhookIds[0],
      eventType: "trace.created",
      payload: {
        traceId: "trace_2k9x7m4n",
        name: "User Authentication Flow",
        status: "pending",
        durationMs: 0,
      },
      status: "success",
      responseStatus: 200,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.completed",
      payload: {
        traceId: "trace_2k9x7m4n",
        name: "User Authentication Flow",
        status: "completed",
        durationMs: 3456,
      },
      status: "success",
      responseStatus: 201,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.failed",
      payload: {
        traceId: "trace_8h5p2q1r",
        name: "Database Query",
        status: "failed",
        durationMs: 12500,
      },
      status: "failed",
      responseStatus: 500,
      responseBody: '{"error": "Connection timeout"}',
      attemptCount: 3,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.completed",
      payload: { evaluationId: 123, status: "completed", totalCases: 50, passedCases: 45 },
      status: "success",
      responseStatus: 200,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.failed",
      payload: { evaluationId: 124, status: "failed", totalCases: 30, passedCases: 12 },
      status: "failed",
      responseStatus: 502,
      responseBody: '{"error": "Invalid signature"}',
      attemptCount: 2,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.started",
      payload: { evaluationId: 125, status: "running", totalCases: 100, passedCases: 0 },
      status: "pending",
      responseStatus: null,
      responseBody: null,
      attemptCount: 0,
      createdAt: getRandomDate(true),
    },
    {
      webhookId: webhookIds[2],
      eventType: "span.created",
      payload: {
        spanId: "span_9k3m7n2p",
        traceId: "trace_2k9x7m4n",
        name: "API Request",
        type: "http",
      },
      status: "success",
      responseStatus: 200,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.created",
      payload: {
        traceId: "trace_5j8k9m1n",
        name: "Payment Processing",
        status: "pending",
        durationMs: 0,
      },
      status: "success",
      responseStatus: 201,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.completed",
      payload: {
        traceId: "trace_5j8k9m1n",
        name: "Payment Processing",
        status: "completed",
        durationMs: 8923,
      },
      status: "success",
      responseStatus: 200,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.completed",
      payload: { evaluationId: 126, status: "completed", totalCases: 75, passedCases: 73 },
      status: "success",
      responseStatus: 200,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[2],
      eventType: "span.created",
      payload: {
        spanId: "span_4h7k2m9p",
        traceId: "trace_5j8k9m1n",
        name: "Database Query",
        type: "database",
      },
      status: "failed",
      responseStatus: 503,
      responseBody: '{"error": "Connection timeout"}',
      attemptCount: 3,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.failed",
      payload: {
        traceId: "trace_1m4n7k2p",
        name: "File Upload",
        status: "failed",
        durationMs: 25000,
      },
      status: "failed",
      responseStatus: 400,
      responseBody: '{"error": "Invalid signature"}',
      attemptCount: 2,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.started",
      payload: { evaluationId: 127, status: "running", totalCases: 200, passedCases: 0 },
      status: "success",
      responseStatus: 200,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[2],
      eventType: "span.created",
      payload: {
        spanId: "span_7k9m2n4p",
        traceId: "trace_1m4n7k2p",
        name: "S3 Upload",
        type: "storage",
      },
      status: "success",
      responseStatus: 201,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[3],
      eventType: "trace.created",
      payload: {
        traceId: "trace_8n2m4k7p",
        name: "Email Service",
        status: "pending",
        durationMs: 0,
      },
      status: "pending",
      responseStatus: null,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(true),
    },
    {
      webhookId: webhookIds[3],
      eventType: "trace.completed",
      payload: {
        traceId: "trace_3k7m9n2p",
        name: "Search Query",
        status: "completed",
        durationMs: 1234,
      },
      status: "success",
      responseStatus: 200,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.failed",
      payload: { evaluationId: 128, status: "failed", totalCases: 40, passedCases: 15 },
      status: "failed",
      responseStatus: 500,
      responseBody: '{"error": "Connection timeout"}',
      attemptCount: 3,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[2],
      eventType: "span.created",
      payload: {
        spanId: "span_5m7k9n2p",
        traceId: "trace_3k7m9n2p",
        name: "Redis Cache",
        type: "cache",
      },
      status: "success",
      responseStatus: 200,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[0],
      eventType: "trace.completed",
      payload: {
        traceId: "trace_9m2k4n7p",
        name: "ML Model Inference",
        status: "completed",
        durationMs: 15678,
      },
      status: "success",
      responseStatus: 201,
      responseBody: null,
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
    {
      webhookId: webhookIds[1],
      eventType: "evaluation.completed",
      payload: { evaluationId: 129, status: "completed", totalCases: 150, passedCases: 148 },
      status: "success",
      responseStatus: 200,
      responseBody: '{"received": true}',
      attemptCount: 1,
      createdAt: getRandomDate(),
    },
  ];

  await db.insert(webhookDeliveries).values(sampleDeliveries);

  console.log("✅ Webhook deliveries seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
