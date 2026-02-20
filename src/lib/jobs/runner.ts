import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { logger } from "@/lib/logger";
import { handleWebhookDelivery } from "./handlers/webhook-delivery";

export type JobStatus = "pending" | "running" | "success" | "failed" | "dead_letter";

/** Exponential backoff delays in milliseconds per attempt number (1-indexed) */
const BACKOFF_MS: Record<number, number> = {
  1: 1 * 60 * 1000, // 1 min
  2: 5 * 60 * 1000, // 5 min
  3: 15 * 60 * 1000, // 15 min
  4: 60 * 60 * 1000, // 1 h
  5: 4 * 60 * 60 * 1000, // 4 h
};

const MAX_JOBS_PER_RUN = 10;

type HandlerFn = (payload: Record<string, unknown>) => Promise<void>;

const HANDLERS: Record<string, HandlerFn> = {
  webhook_delivery: handleWebhookDelivery,
};

/**
 * Process up to MAX_JOBS_PER_RUN due jobs.
 *
 * Uses an optimistic lock: only processes a job if the UPDATE claiming it
 * returns a row (i.e., no other invocation claimed it first).
 *
 * Returns counts of processed and failed jobs.
 */
export async function runDueJobs(): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  let processed = 0;
  let failed = 0;

  // Select candidates — don't claim yet, just peek
  const candidates = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      payload: jobs.payload,
      attempt: jobs.attempt,
      maxAttempts: jobs.maxAttempts,
    })
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.nextRunAt, now)))
    .limit(MAX_JOBS_PER_RUN);

  for (const candidate of candidates) {
    // Optimistic lock: claim the job atomically
    const claimed = await db
      .update(jobs)
      .set({ status: "running", updatedAt: new Date() })
      .where(and(eq(jobs.id, candidate.id), eq(jobs.status, "pending")))
      .returning({ id: jobs.id });

    if (!claimed[0]) {
      // Another invocation claimed it first — skip
      continue;
    }

    const handler = HANDLERS[candidate.type];
    if (!handler) {
      logger.error("No handler registered for job type", {
        jobId: candidate.id,
        type: candidate.type,
      });
      await db
        .update(jobs)
        .set({
          status: "failed",
          lastError: `No handler for type: ${candidate.type}`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, candidate.id));
      failed++;
      continue;
    }

    try {
      await handler(candidate.payload as Record<string, unknown>);

      await db
        .update(jobs)
        .set({ status: "success", updatedAt: new Date() })
        .where(eq(jobs.id, candidate.id));

      logger.info("Job completed", { jobId: candidate.id, type: candidate.type });
      processed++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const nextAttempt = candidate.attempt + 1;
      const isDeadLetter = nextAttempt >= candidate.maxAttempts;
      const backoffMs = BACKOFF_MS[nextAttempt] ?? BACKOFF_MS[5];
      const nextRunAt = new Date(Date.now() + backoffMs);

      await db
        .update(jobs)
        .set({
          status: isDeadLetter ? "dead_letter" : "pending",
          attempt: nextAttempt,
          lastError: error,
          nextRunAt: isDeadLetter ? now : nextRunAt,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, candidate.id));

      logger.warn("Job failed", {
        jobId: candidate.id,
        type: candidate.type,
        attempt: nextAttempt,
        isDeadLetter,
        error,
      });
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Compute the next run time for a retry based on attempt number.
 * Exported for testing.
 */
export function nextRetryAt(attemptNumber: number): Date {
  const delayMs = BACKOFF_MS[attemptNumber] ?? BACKOFF_MS[5];
  return new Date(Date.now() + delayMs);
}
