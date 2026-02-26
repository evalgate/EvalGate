import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, jobs } from "@/db/schema";
import { validationError } from "@/lib/api/errors";
import { secureRoute } from "@/lib/api/secure-route";
import type { BulkJobResult, RetryMode } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";

const MAX_BULK_SIZE = 100;

/**
 * POST /api/jobs/dead/bulk-retry
 *
 * Bulk retry dead-letter jobs. Admin-only, org-scoped.
 *
 * Body (JSON):
 *   jobIds    — array of job IDs to retry (max 100)
 *   mode      — "now" | "later" | "reset" (default: "reset")
 *   errorCode — (alternative) retry all DLQ jobs matching this error code
 *
 * Returns per-job results: { results: [{ jobId, ok, error? }] }
 */
export const POST = secureRoute(
  async (req: NextRequest, ctx) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return validationError("Request body must be valid JSON");
    }

    const mode: RetryMode = (body.mode as RetryMode) ?? "reset";
    if (!["now", "later", "reset"].includes(mode)) {
      return validationError("mode must be 'now', 'later', or 'reset'");
    }

    // Determine target job IDs
    let targetIds: number[] = [];

    if (Array.isArray(body.jobIds)) {
      if (body.jobIds.length > MAX_BULK_SIZE) {
        return validationError(`Maximum ${MAX_BULK_SIZE} jobs per bulk retry`);
      }
      targetIds = body.jobIds.filter(
        (id: unknown) => typeof id === "number" && Number.isFinite(id) && id > 0,
      );
      if (targetIds.length === 0) {
        return validationError("jobIds must contain at least one valid numeric ID");
      }
    } else if (typeof body.errorCode === "string" && body.errorCode.length > 0) {
      // Fetch DLQ jobs by error code for this org
      const matching = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "dead_letter"),
            eq(jobs.organizationId, ctx.organizationId),
            eq(jobs.lastErrorCode, body.errorCode as string),
          ),
        )
        .limit(MAX_BULK_SIZE);
      targetIds = matching.map((j) => j.id);
      if (targetIds.length === 0) {
        return NextResponse.json({ results: [], total: 0 });
      }
    } else {
      return validationError("Provide either jobIds (number[]) or errorCode (string)");
    }

    const now = new Date();
    const RETRY_LATER_MS = 5 * 60 * 1000;
    const nextRunAt = mode === "later" ? new Date(now.getTime() + RETRY_LATER_MS) : now;

    const results: BulkJobResult[] = [];

    // Process each job individually for per-job error reporting
    for (const jobId of targetIds) {
      try {
        const [job] = await db
          .select({ id: jobs.id, status: jobs.status, attempt: jobs.attempt })
          .from(jobs)
          .where(and(eq(jobs.id, jobId), eq(jobs.organizationId, ctx.organizationId)))
          .limit(1);

        if (!job) {
          results.push({ jobId, ok: false, error: "not_found" });
          continue;
        }

        if (job.status !== "dead_letter") {
          results.push({ jobId, ok: false, error: `status_is_${job.status}` });
          continue;
        }

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
        results.push({ jobId, ok: true });
      } catch (err) {
        results.push({
          jobId,
          ok: false,
          error: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }

    // Bulk audit log
    const succeeded = results.filter((r) => r.ok).map((r) => r.jobId);
    if (succeeded.length > 0) {
      try {
        await db.insert(auditLogs).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "job.bulk_retry",
          resourceType: "job",
          resourceId: succeeded.join(","),
          metadata: { mode, count: succeeded.length },
          createdAt: now,
        });
      } catch {
        // Best-effort audit
      }
    }

    logger.info("Bulk job retry", {
      mode,
      total: targetIds.length,
      succeeded: succeeded.length,
      failed: targetIds.length - succeeded.length,
      userId: ctx.userId,
    });

    return NextResponse.json({
      results,
      total: results.length,
      succeeded: succeeded.length,
      failed: results.length - succeeded.length,
    });
  },
  { minRole: "admin" },
);
