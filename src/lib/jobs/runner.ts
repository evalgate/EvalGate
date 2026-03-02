import { and, eq, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobRunnerLocks, jobs } from "@/db/schema";
import { logger } from "@/lib/logger";
import {
	handleWebhookDelivery,
	WebhookDeliveryError,
} from "./handlers/webhook-delivery";
import { validatePayload } from "./payload-schemas";
import { JobErrorCodes, type JobType, type RunnerResult } from "./types";

export type { JobStatus } from "./types";

/** Exponential backoff delays in milliseconds per attempt number (1-indexed) */
const BACKOFF_MS: Record<number, number> = {
	1: 1 * 60 * 1000, // 1 min
	2: 5 * 60 * 1000, // 5 min
	3: 15 * 60 * 1000, // 15 min
	4: 60 * 60 * 1000, // 1 h
	5: 4 * 60 * 60 * 1000, // 4 h
};

/** Jitter factor: delay * (1 - JITTER .. 1 + JITTER) */
const JITTER_FACTOR = 0.1;

const MAX_JOBS_PER_RUN = Number(process.env.MAX_JOBS_PER_RUN ?? 10);
const RUNNER_TIME_BUDGET_MS = Number(
	process.env.RUNNER_TIME_BUDGET_MS ?? 20_000,
);
/** How long a claimed job lock is valid before it can be reclaimed */
const JOB_LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes
/** How long the global runner lock is held */
const RUNNER_LOCK_TTL_MS = 60 * 1000; // 60 seconds
/** Truncate lastError to avoid unbounded growth */
const MAX_ERROR_LENGTH = 2048;

type HandlerFn = (payload: Record<string, unknown>) => Promise<void>;

const HANDLERS: Record<string, HandlerFn> = {
	webhook_delivery: handleWebhookDelivery,
};

/**
 * Process up to MAX_JOBS_PER_RUN due jobs.
 *
 * Steps:
 *  1. Acquire global runner lock (prevents stampedes)
 *  2. Reclaim expired running jobs (TTL recovery)
 *  3. Peek candidates
 *  4. Per-job: optimistic claim → payload validation → handler → timing/status update
 *  5. Stop when time budget is nearly exhausted
 *  6. Release global lock
 */
export async function runDueJobs(runId?: string): Promise<RunnerResult> {
	const start = Date.now();
	const id = runId ?? `runner-${start}`;
	const nowMs = start;

	const result: RunnerResult = {
		processed: 0,
		failed: 0,
		reclaimed: 0,
		deadLettered: 0,
		stoppedEarly: false,
		runtimeMs: 0,
	};

	// ── Step 1: Acquire global runner lock ──────────────────────────────────────
	const lockAcquired = await acquireRunnerLock(id, nowMs);
	if (!lockAcquired) {
		logger.info("Job runner skipped — lock held by another invocation", {
			runId: id,
		});
		return { ...result, skipped: "lock_held", runtimeMs: Date.now() - start };
	}

	try {
		// ── Step 2: Reclaim expired running jobs (tag with LOCK_TIMEOUT_RECLAIMED) ─
		const reclaimed = await reclaimExpiredJobs(nowMs);
		result.reclaimed = reclaimed;

		// ── Step 3: Peek candidates (pending due + stale running for reclaim) ─────
		const now = new Date(nowMs);
		const candidates = await db
			.select({
				id: jobs.id,
				type: jobs.type,
				payload: jobs.payload,
				status: jobs.status,
				attempt: jobs.attempt,
				maxAttempts: jobs.maxAttempts,
			})
			.from(jobs)
			.where(
				or(
					and(eq(jobs.status, "pending"), lte(jobs.nextRunAt, now)),
					and(eq(jobs.status, "running"), lte(jobs.lockedUntil, now)),
				),
			)
			.limit(MAX_JOBS_PER_RUN);

		// ── Step 4: Process each candidate ───────────────────────────────────────
		for (const candidate of candidates) {
			// Time budget check — stop before claiming if nearly out of time
			if (Date.now() - start >= RUNNER_TIME_BUDGET_MS - 1000) {
				result.stoppedEarly = true;
				break;
			}

			const claimTime = Date.now();
			const lockedUntil = new Date(claimTime + JOB_LOCK_TTL_MS);

			// Optimistic claim: covers both pending jobs and stale running (reclaim)
			const claimed = await db
				.update(jobs)
				.set({
					status: "running",
					lockedAt: new Date(claimTime),
					lockedUntil,
					lockedBy: id,
					lastStartedAt: new Date(claimTime),
					updatedAt: new Date(claimTime),
				})
				.where(
					and(
						eq(jobs.id, candidate.id),
						or(
							eq(jobs.status, "pending"),
							and(
								eq(jobs.status, "running"),
								lte(jobs.lockedUntil, new Date(claimTime)),
							),
						),
					),
				)
				.returning({ id: jobs.id });

			if (claimed[0]) {
				logger.info("Job claimed", {
					jobId: candidate.id,
					lockedBy: id,
					lockUntil: lockedUntil.toISOString(),
					attempt: candidate.attempt,
					wasReclaim: candidate.status === "running",
				});
			}

			if (!claimed[0]) {
				// Another invocation claimed it first — skip
				continue;
			}

			// ── Payload validation ──────────────────────────────────────────────────
			const validation = validatePayload(
				candidate.type as JobType,
				candidate.payload,
			);
			if (!validation.success) {
				const errMsg = validation.error.substring(0, MAX_ERROR_LENGTH);
				logger.error("Job payload invalid — dead-lettering", {
					jobId: candidate.id,
					type: candidate.type,
					error: errMsg,
				});
				const finishTime = Date.now();
				await db
					.update(jobs)
					.set({
						status: "dead_letter",
						lastError: errMsg,
						lastErrorCode: JobErrorCodes.PAYLOAD_INVALID,
						lastFinishedAt: new Date(finishTime),
						lastDurationMs: finishTime - claimTime,
						lockedAt: null,
						lockedUntil: null,
						lockedBy: null,
						updatedAt: new Date(finishTime),
					})
					.where(eq(jobs.id, candidate.id));
				result.deadLettered++;
				result.failed++;
				continue;
			}

			// ── Missing handler ─────────────────────────────────────────────────────
			const handler = HANDLERS[candidate.type];
			if (!handler) {
				logger.error("No handler registered for job type — dead-lettering", {
					jobId: candidate.id,
					type: candidate.type,
				});
				const finishTime = Date.now();
				await db
					.update(jobs)
					.set({
						status: "dead_letter",
						lastError: `No handler for type: ${candidate.type}`,
						lastErrorCode: JobErrorCodes.HANDLER_MISSING,
						lastFinishedAt: new Date(finishTime),
						lastDurationMs: finishTime - claimTime,
						lockedAt: null,
						lockedUntil: null,
						lockedBy: null,
						updatedAt: new Date(finishTime),
					})
					.where(eq(jobs.id, candidate.id));
				result.deadLettered++;
				result.failed++;
				continue;
			}

			// ── Execute handler ─────────────────────────────────────────────────────
			try {
				await handler(validation.data);

				const finishTime = Date.now();
				await db
					.update(jobs)
					.set({
						status: "success",
						lastFinishedAt: new Date(finishTime),
						lastDurationMs: finishTime - claimTime,
						lockedAt: null,
						lockedUntil: null,
						lockedBy: null,
						updatedAt: new Date(finishTime),
					})
					.where(eq(jobs.id, candidate.id));

				logger.info("Job completed", {
					jobId: candidate.id,
					type: candidate.type,
					durationMs: finishTime - claimTime,
				});
				result.processed++;
			} catch (err) {
				const error = err instanceof Error ? err.message : String(err);
				const truncatedError = error.substring(0, MAX_ERROR_LENGTH);
				const nextAttempt = candidate.attempt + 1;
				const isDeadLetter = nextAttempt >= candidate.maxAttempts;

				// Determine error code from typed errors
				let errorCode: string = JobErrorCodes.HANDLER_ERROR;
				if (err instanceof WebhookDeliveryError) {
					errorCode = err.errorCode;
				}

				// Use Retry-After from 429 responses if available, otherwise standard backoff
				let retryDelayMs: number;
				if (err instanceof WebhookDeliveryError && err.retryAfterMs) {
					retryDelayMs = err.retryAfterMs;
				} else {
					retryDelayMs = applyJitter(BACKOFF_MS[nextAttempt] ?? BACKOFF_MS[5]);
				}
				const nextRunAt = new Date(Date.now() + retryDelayMs);
				const finishTime = Date.now();

				await db
					.update(jobs)
					.set({
						status: isDeadLetter ? "dead_letter" : "pending",
						attempt: nextAttempt,
						lastError: truncatedError,
						lastErrorCode: errorCode,
						nextRunAt: isDeadLetter ? new Date(nowMs) : nextRunAt,
						lastFinishedAt: new Date(finishTime),
						lastDurationMs: finishTime - claimTime,
						lockedAt: null,
						lockedUntil: null,
						lockedBy: null,
						updatedAt: new Date(finishTime),
					})
					.where(eq(jobs.id, candidate.id));

				logger.warn("Job failed", {
					jobId: candidate.id,
					type: candidate.type,
					attempt: nextAttempt,
					isDeadLetter,
					errorCode,
					durationMs: finishTime - claimTime,
					nextRunAt: isDeadLetter ? undefined : nextRunAt.toISOString(),
					error: truncatedError,
				});

				if (isDeadLetter) result.deadLettered++;
				result.failed++;
			}
		}
	} finally {
		// ── Step 5: Release global lock ───────────────────────────────────────────
		await releaseRunnerLock(id, nowMs);
	}

	result.runtimeMs = Date.now() - start;

	logger.info("Job runner completed", {
		runId: id,
		...result,
	});

	return result;
}

// ── Lock helpers ──────────────────────────────────────────────────────────────

async function acquireRunnerLock(
	runId: string,
	nowMs: number,
): Promise<boolean> {
	const lockedUntil = nowMs + RUNNER_LOCK_TTL_MS;
	try {
		// Acquire only if lock is expired (locked_until < now)
		const res = await db
			.update(jobRunnerLocks)
			.set({ lockedUntil, lockedBy: runId, updatedAt: nowMs })
			.where(
				and(
					eq(jobRunnerLocks.lockName, "default"),
					lt(jobRunnerLocks.lockedUntil, nowMs),
				),
			)
			.returning({ lockName: jobRunnerLocks.lockName });
		return res.length > 0;
	} catch {
		return false;
	}
}

async function releaseRunnerLock(runId: string, nowMs: number): Promise<void> {
	try {
		await db
			.update(jobRunnerLocks)
			.set({ lockedUntil: 0, lockedBy: null, updatedAt: nowMs })
			.where(
				and(
					eq(jobRunnerLocks.lockName, "default"),
					eq(jobRunnerLocks.lockedBy, runId),
				),
			);
	} catch {
		// Best-effort release — lock will expire naturally via TTL
	}
}

async function reclaimExpiredJobs(nowMs: number): Promise<number> {
	try {
		const reclaimed = await db
			.update(jobs)
			.set({
				status: "pending",
				lastErrorCode: JobErrorCodes.LOCK_TIMEOUT_RECLAIMED,
				lockedAt: null,
				lockedUntil: null,
				lockedBy: null,
				updatedAt: new Date(nowMs),
			})
			.where(
				and(eq(jobs.status, "running"), lt(jobs.lockedUntil, new Date(nowMs))),
			)
			.returning({ id: jobs.id });

		if (reclaimed.length > 0) {
			logger.info("Reclaimed expired running jobs", {
				count: reclaimed.length,
				jobIds: reclaimed.map((r: { id: number }) => r.id),
				errorCode: JobErrorCodes.LOCK_TIMEOUT_RECLAIMED,
			});
		}
		return reclaimed.length;
	} catch {
		return 0;
	}
}

/**
 * Apply jitter to a delay value: delay * (0.9 + rand * 0.2).
 * Prevents thundering herd on retries.
 */
function applyJitter(delayMs: number): number {
	const jitter = 1 - JITTER_FACTOR + Math.random() * JITTER_FACTOR * 2;
	return Math.round(delayMs * jitter);
}

/**
 * Compute the next run time for a retry based on attempt number.
 * Includes jitter to prevent thundering herd.
 * Exported for testing.
 */
export function nextRetryAt(attemptNumber: number): Date {
	const delayMs = applyJitter(BACKOFF_MS[attemptNumber] ?? BACKOFF_MS[5]);
	return new Date(Date.now() + delayMs);
}

// Re-export sql for use in raw queries if needed
export { sql };
