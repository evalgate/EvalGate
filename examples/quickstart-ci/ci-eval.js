#!/usr/bin/env node
/**
 * EvalAI Quickstart CI Script
 *
 * Creates an evaluation, adds test cases, runs it, and gates on quality score.
 * Use in GitHub Actions or any CI pipeline.
 *
 * Required env: EVALAI_API_KEY, WEBHOOK_URL
 * Optional: EVALAI_BASE_URL (default: production)
 */

import { AIEvalClient } from "@pauly4010/evalai-sdk";

const baseUrl = process.env.EVALAI_BASE_URL || "https://v0-ai-evaluation-platform-nu.vercel.app";
const apiKey = process.env.EVALAI_API_KEY;
const webhookUrl = process.env.WEBHOOK_URL;

if (!apiKey) {
  console.error("Error: EVALAI_API_KEY is required");
  process.exit(5);
}

if (!webhookUrl) {
  console.error("Error: WEBHOOK_URL is required for webhook executor");
  process.exit(5);
}

async function main() {
  const client = new AIEvalClient({ baseUrl, apiKey });

  // 1. Create evaluation with webhook executor
  const evaluation = await client.evaluations.create({
    name: `CI Gate ${new Date().toISOString().slice(0, 10)}`,
    description: "Quickstart CI evaluation",
    type: "unit_test",
    executorType: "webhook",
    executorConfig: { url: webhookUrl },
  });
  console.log(`Created evaluation: ${evaluation.id}`);

  // 2. Add test cases
  const cases = [
    { name: "Greeting", input: "Hello", expectedOutput: "greeting" },
    { name: "Help", input: "Help me", expectedOutput: "assistance" },
  ];
  for (const tc of cases) {
    await client.evaluations.createTestCase(evaluation.id, tc);
  }
  console.log(`Added ${cases.length} test cases`);

  // 3. Run evaluation
  const run = await client.evaluations.createRun(evaluation.id, {});
  console.log(`Started run: ${run.id}`);

  // 4. Poll for completion
  let status = run.status;
  while (status === "pending" || status === "running") {
    await new Promise((r) => setTimeout(r, 3000));
    const updated = await client.evaluations.getRun(evaluation.id, run.id);
    status = updated.status;
    console.log(`  Status: ${status}`);
  }

  if (status === "failed") {
    console.error("Evaluation run failed");
    process.exit(4);
  }

  // 5. Gate: fetch quality score and fail if below threshold
  const scoreRes = await fetch(
    `${baseUrl}/api/quality?evaluationId=${evaluation.id}&action=latest`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!scoreRes.ok) {
    console.error("Failed to fetch quality score");
    process.exit(4);
  }
  const { score, total, evidenceLevel } = await scoreRes.json();
  console.log(`\nQuality Score: ${score}/100 (total: ${total}, evidence: ${evidenceLevel})`);

  const minScore = 85;
  const minN = 2;
  if (score < minScore) {
    console.error(`\nFAILED: score ${score} < minScore ${minScore}`);
    process.exit(1);
  }
  if (total != null && total < minN) {
    console.error(`\nFAILED: total test cases ${total} < minN ${minN}`);
    process.exit(6);
  }
  if (evidenceLevel === "weak") {
    console.error("\nFAILED: evidence level is weak");
    process.exit(7);
  }

  console.log("\n✓ EvalAI gate PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(4);
});
