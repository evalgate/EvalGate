// src/app/actions/run-eval.ts
"use server";

import { z } from "zod";
import { protectedAction } from "@/lib/actions/protected";
import { evalGateway } from "@/lib/gateway/eval-gateway";

// Input validation schema
const StartEvalSchema = z.object({
  evaluationId: z.number(),
  testCases: z.array(z.string()).optional(), // Optional override test case IDs
  settings: z.record(z.any()).optional(), // Optional runtime settings
});

/**
 * Server action to start an evaluation.
 * Uses protectedAction wrapper to ensure authentication and organization scoping.
 * Returns immediately with a PENDING run ID; actual processing happens in background worker.
 */
export const startEval = protectedAction(async (ctx, input: z.infer<typeof StartEvalSchema>) => {
  const parsed = StartEvalSchema.parse(input);

  // Gateway creates PENDING run and returns immediately
  const run = await evalGateway.startRun(parsed.evaluationId, ctx.organizationId, ctx.userId, {
    testCases: parsed.testCases,
    settings: parsed.settings,
  });

  return { runId: run.id, status: "pending" };
});

/**
 * Server action to get evaluation run status.
 * Used by UI to poll for progress updates.
 */
export const getEvalRunStatus = protectedAction(async (ctx, runId: number) => {
  const run = await evalGateway.getRunStatus(runId, ctx.organizationId);
  return run;
});

/**
 * Server action to cancel an evaluation run.
 */
export const cancelEvalRun = protectedAction(async (ctx, runId: number) => {
  await evalGateway.cancelRun(runId, ctx.organizationId);
  return { success: true };
});
