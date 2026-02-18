/**
 * Example: Webhook Executor
 *
 * Evaluates a customer-hosted endpoint by sending test inputs via webhook
 * and scoring the responses.
 *
 * This is the universal executor pattern — it works with any model,
 * framework, or language as long as the endpoint accepts a POST with
 * `{ input: string }` and returns `{ output: string }`.
 *
 * Usage:
 *   Set EVALAI_API_KEY + EVALAI_BASE_URL + WEBHOOK_URL env vars, then:
 *   npx ts-node examples/webhook-executor.ts
 */

import { AIEvalClient } from "@pauly4010/evalai-sdk";

async function main() {
  const client = new AIEvalClient({
    baseUrl: process.env.EVALAI_BASE_URL || "http://localhost:3000",
    apiKey: process.env.EVALAI_API_KEY || "",
  });

  const webhookUrl = process.env.WEBHOOK_URL || "https://my-app.example.com/api/generate";
  const webhookSecret = process.env.WEBHOOK_SECRET; // optional

  // 1. Create an evaluation using a Webhook executor
  const evaluation = await client.evaluations.create({
    name: "Chatbot Quality Gate",
    description: "Tests the production chatbot endpoint via webhook",
    type: "unit_test",
    executorType: "webhook",
    executorConfig: {
      url: webhookUrl,
      secret: webhookSecret,
      timeoutMs: 30000,
    },
  });

  console.log(`Created evaluation: ${evaluation.id}`);

  // 2. Add test cases (input = what we send, expectedOutput = what we assert)
  const testCases = [
    {
      name: "Greeting",
      input: "Hello, how are you?",
      expectedOutput: "greeting response",
    },
    {
      name: "Product question",
      input: "What does your product do?",
      expectedOutput: "product description",
    },
    {
      name: "Out-of-scope",
      input: "Write me a poem about cats",
      expectedOutput: "polite redirect to product topics",
    },
  ];

  for (const tc of testCases) {
    await client.evaluations.addTestCase(evaluation.id, tc);
  }

  console.log(`Added ${testCases.length} test cases`);

  // 3. Run the evaluation
  const run = await client.evaluations.run(evaluation.id);
  console.log(`Started run: ${run.id}`);

  // 4. Poll for completion
  let status = run.status;
  while (status === "pending" || status === "running") {
    await new Promise((r) => setTimeout(r, 3000));
    const updated = await client.evaluations.getRun(evaluation.id, run.id);
    status = updated.status;
    console.log(`  Status: ${status}`);
  }

  // 5. Fetch results
  const quality = await client.quality.latest(evaluation.id);
  console.log(`\nQuality Score: ${quality.score}/100`);

  // 6. Generate a signed report for audit
  const report = await client.reports.create({
    evaluationId: evaluation.id,
    evaluationRunId: run.id,
  });

  console.log(`\nReport generated: ${report.shareUrl}`);
}

main().catch(console.error);
