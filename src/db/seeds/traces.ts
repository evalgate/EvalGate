import { db } from "@/db";
import { traces } from "@/db/schema";

async function main() {
  const now = new Date();
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const sampleTraces = [
    {
      name: "Chat Completion Request",
      traceId: "trace_001",
      organizationId: 1,
      status: "success",
      durationMs: 1250,
      metadata: JSON.stringify({ model: "gpt-4", tokens: 1500, temperature: 0.7 }),
      createdAt: hoursAgo(2),
    },
    {
      name: "Document Summarization",
      traceId: "trace_002",
      organizationId: 1,
      status: "success",
      durationMs: 3400,
      metadata: JSON.stringify({ model: "gpt-4", tokens: 3200, documentLength: 5000 }),
      createdAt: hoursAgo(5),
    },
    {
      name: "Code Generation Task",
      traceId: "trace_003",
      organizationId: 1,
      status: "success",
      durationMs: 2100,
      metadata: JSON.stringify({ model: "gpt-4", tokens: 2400, language: "typescript" }),
      createdAt: hoursAgo(8),
    },
    {
      name: "Sentiment Analysis Job",
      traceId: "trace_004",
      organizationId: 2,
      status: "success",
      durationMs: 850,
      metadata: JSON.stringify({ model: "gpt-3.5-turbo", tokens: 800, sentiment: "positive" }),
      createdAt: hoursAgo(10),
    },
    {
      name: "Translation Pipeline",
      traceId: "trace_005",
      organizationId: 2,
      status: "success",
      durationMs: 1900,
      metadata: JSON.stringify({
        model: "gpt-4",
        tokens: 1800,
        sourceLang: "en",
        targetLang: "es",
      }),
      createdAt: hoursAgo(12),
    },
    {
      name: "Failed API Call",
      traceId: "trace_006",
      organizationId: 1,
      status: "error",
      durationMs: 500,
      metadata: JSON.stringify({ error: "Rate limit exceeded", retryAfter: 60 }),
      createdAt: hoursAgo(15),
    },
    {
      name: "Batch Processing",
      traceId: "trace_007",
      organizationId: 1,
      status: "success",
      durationMs: 15000,
      metadata: JSON.stringify({
        model: "gpt-4",
        totalItems: 50,
        processedItems: 50,
        tokensUsed: 12000,
      }),
      createdAt: hoursAgo(18),
    },
    {
      name: "Model Inference",
      traceId: "trace_008",
      organizationId: 2,
      status: "success",
      durationMs: 750,
      metadata: JSON.stringify({ model: "gpt-3.5-turbo", tokens: 600, cacheHit: true }),
      createdAt: hoursAgo(20),
    },
  ];

  await db.insert(traces).values(sampleTraces);

  console.log("✅ Traces seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
