import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { logger } from "@/lib/logger";

export type JobType = "webhook_delivery";

export interface EnqueueOptions {
  idempotencyKey?: string;
  organizationId?: number;
  maxAttempts?: number;
  /** Run at a specific time; defaults to now */
  runAt?: Date;
}

/**
 * Enqueue a background job.
 *
 * If an idempotencyKey is provided and a job with that key already exists,
 * returns the existing job ID instead of inserting a duplicate.
 */
export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<number> {
  const { idempotencyKey, organizationId, maxAttempts = 5, runAt = new Date() } = opts;

  // Check for existing job with same idempotency key
  if (idempotencyKey) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing[0]) {
      logger.info("Job already enqueued (idempotency key match)", {
        jobId: existing[0].id,
        idempotencyKey,
        type,
      });
      return existing[0].id;
    }
  }

  const [inserted] = await db
    .insert(jobs)
    .values({
      type,
      payload,
      status: "pending",
      attempt: 0,
      maxAttempts,
      nextRunAt: runAt,
      idempotencyKey: idempotencyKey ?? null,
      organizationId: organizationId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: jobs.id });

  logger.info("Job enqueued", { jobId: inserted.id, type, idempotencyKey });
  return inserted.id;
}
