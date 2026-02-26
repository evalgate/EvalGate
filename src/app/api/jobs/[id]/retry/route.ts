import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, jobs } from "@/db/schema";
import { conflict, notFound, validationError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import type { RetryMode } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";

/** Backoff delay for "later" mode (5 minutes). */
const RETRY_LATER_MS = 5 * 60 * 1000;

/**
 * POST /api/jobs/:id/retry
 *
 * Retry a dead-letter job. Admin-only, org-scoped.
 *
 * Body (JSON, optional):
 *   mode — "now" | "later" | "reset" (default: "reset")
 *
 * Modes:
 *   now   — nextRunAt = now, keeps attempt count
 *   later — nextRunAt = now + backoff, keeps attempt count
 *   reset — attempt=0, nextRunAt = now, clears errors (full requeue)
 */
export const POST = secureRoute(
  async (req: NextRequest, ctx, params) => {
    const jobId = Number(params.id);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return notFound("Job not found");
    }

    // Parse optional body
    let mode: RetryMode = "reset";
    try {
      const body = await req.json().catch(() => ({}));
      if (body.mode) {
        if (!["now", "later", "reset"].includes(body.mode)) {
          return validationError("mode must be 'now', 'later', or 'reset'");
        }
        mode = body.mode as RetryMode;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const [job] = await db
      .select({
        id: jobs.id,
        status: jobs.status,
        attempt: jobs.attempt,
        organizationId: jobs.organizationId,
      })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.organizationId, ctx.organizationId)))
      .limit(1);

    if (!job) {
      return notFound("Job not found");
    }

    if (job.status !== "dead_letter") {
      return conflict(`Job is not in dead_letter status (current: ${job.status})`);
    }

    const now = new Date();
    const nextRunAt = mode === "later" ? new Date(now.getTime() + RETRY_LATER_MS) : now;

    const updateFields: Record<string, unknown> = {
      status: "pending",
      nextRunAt,
      lockedAt: null,
      lockedUntil: null,
      lockedBy: null,
      updatedAt: now,
    };

    if (mode === "reset") {
      updateFields.attempt = 0;
      updateFields.lastError = null;
      updateFields.lastErrorCode = null;
    }

    await db.update(jobs).set(updateFields).where(eq(jobs.id, jobId));

    // Audit log
    try {
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "job.retry",
        resourceType: "job",
        resourceId: String(jobId),
        metadata: { mode, previousAttempt: job.attempt },
        createdAt: now,
      });
    } catch {
      // Best-effort audit — don't fail the retry
    }

    logger.info("Job retried via admin API", {
      jobId,
      mode,
      nextRunAt: nextRunAt.toISOString(),
      userId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      jobId,
      mode,
      nextRunAt: nextRunAt.toISOString(),
    });
  },
  { minRole: "admin" },
);
