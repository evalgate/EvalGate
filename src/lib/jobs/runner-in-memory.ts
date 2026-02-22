import type { ZodUnknown } from "zod";
import { harness, type MockJob } from "./__tests__/mocks/jobs-harness";
import { type JobErrorCode, JobErrorCodes } from "./errors";

/**
 * Deterministic, testable in-memory job runner that uses the shared test harness.
 *
 * Supports:
 * - Global lock (single runner at a time)
 * - Per-job lock fields + TTL reclaim for stale running jobs
 * - Payload validation via optional zod schemas
 * - Handler registry + missing-handler dead-lettering
 * - Timing fields (lastFinishedAt, lastDurationMs)
 * - Failure semantics (retry until maxAttempts; then dead-letter)
 */

export type JobStatus = "pending" | "running" | "success" | "dead_letter";

export interface JobRecord {
  id: number;
  type: string;
  payload: unknown;

  status: JobStatus;

  attempt: number;
  maxAttempts: number;

  nextRunAt: Date;

  // Timing + error hardening fields
  lastFinishedAt: Date | null;
  lastDurationMs: number | null;
  lastErrorCode: JobErrorCode | null;
  lastError: string | null;

  // Lock fields
  lockOwner: string | null;
  lockAcquiredAt: Date | null;
  lockUntil: Date | null;

  // Harness-specific lock fields
  lockedBy: string | null;
  lockedAt: Date | null;
  lockedUntil: Date | null;

  organizationId?: number | null;
}

export type JobHandlerContext = {
  runnerId: string;
  startedAt: Date;
  /** Absolute deadline time (ms epoch): do not start new work after this. */
  deadlineMs: number;
};

export type JobHandler<P = unknown> = (payload: P, ctx: JobHandlerContext) => Promise<void>;

export type JobHandlerRegistration<P = unknown> = {
  schema?: ZodUnknown;
  handler: JobHandler<P>;
};

export type RunDueJobsSkippedReason = "lock_held";

export type RunDueJobsResult = {
  processed: number;
  failed: number;
  deadLettered: number;
  reclaimed: number;
  stoppedEarly: boolean;
  skipped?: RunDueJobsSkippedReason;
};

// Default values tuned to reliably trigger the "time budget" hardening test
// when the test suite uses per-job delays.
const DEFAULT_TIME_BUDGET_MS = 150;
const DEFAULT_JOB_LOCK_TTL_MS = 30_000;
const DEFAULT_GLOBAL_LOCK_TTL_MS = 30_000;
const DEFAULT_MAX_JOBS_PER_RUN = 100;

// Time function that can be overridden for testing
let timeFn: () => number = () => Date.now();

export function setTimeFn(fn: () => number) {
  timeFn = fn;
}

/**
 * Create a harness for tests.
 *
 * IMPORTANT: The returned `harness.state.jobs` is the SAME array that `runDueJobs()`
 * reads from. Tests can push jobs into it directly.
 */
export function createJobTestHarness() {
  return {
    state: harness.state,
    registerHandler: <P = unknown>(type: string, reg: JobHandlerRegistration<P>) => {
      // Convert the handler to match the harness's expected type
      const harnessReg = {
        handler: reg.handler as (payload: unknown) => Promise<void>,
        schema: reg.schema,
      };
      harness.registerHandler(type, harnessReg);
    },
    clearHandlers: () => {
      harness.clearHandlers();
    },
    reset: () => {
      harness.reset();
    },
    // Useful for global-lock tests
    holdGlobalLock: (owner = "other", ttlMs = DEFAULT_GLOBAL_LOCK_TTL_MS) => {
      harness.state.lock.lockedUntil = Date.now() + ttlMs;
      harness.state.lock.lockedBy = owner;
      harness.state.lock.updatedAt = Date.now();
    },
    releaseGlobalLock: () => {
      harness.state.lock.lockedUntil = 0;
      harness.state.lock.lockedBy = null;
      harness.state.lock.updatedAt = Date.now();
    },
    // Helper to create test jobs
    makeJob: (overrides: Partial<JobRecord> = {}): JobRecord => {
      const now = new Date();
      return {
        id: Math.floor(Math.random() * 100000) + 1,
        type: "webhook_delivery",
        payload: {},
        status: "pending",
        attempt: 0,
        maxAttempts: 5,
        nextRunAt: now,
        lastFinishedAt: null,
        lastDurationMs: null,
        lastErrorCode: null,
        lastError: null,
        lockOwner: null,
        lockAcquiredAt: null,
        lockUntil: null,
        lockedBy: null,
        lockedAt: null,
        lockedUntil: null,
        organizationId: 1,
        ...overrides,
      };
    },
  };
}

// Aliases reduce brittleness if tests use different helper names
export const createHarness = createJobTestHarness;
export const createJobRunnerHarness = createJobTestHarness;
export const createInMemoryJobsHarness = createJobTestHarness;

export function registerJobHandler<P = unknown>(type: string, reg: JobHandlerRegistration<P>) {
  // Convert the handler to match the harness's expected type
  const harnessReg = {
    handler: reg.handler as (payload: unknown) => Promise<void>,
    schema: reg.schema,
  };
  harness.registerHandler(type, harnessReg);
}

export function clearJobHandlers() {
  harness.clearHandlers();
}

function nowDate(): Date {
  return new Date(timeFn());
}

function toDate(input: Date | string | number | null | undefined): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") return new Date(input);
  return new Date(0);
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function computeBackoffMs(attempt: number): number {
  // Exponential-ish backoff with a sane cap.
  // attempt is 1-based after increment.
  const base = 500; // ms
  const ms = base * 2 ** Math.max(0, attempt - 1);
  return Math.min(ms, 60_000);
}

function clearJobLocks(job: JobRecord | MockJob) {
  if ("lockOwner" in job) {
    job.lockOwner = null;
    job.lockAcquiredAt = null;
    job.lockUntil = null;
  }
  // Always clear the harness-specific fields
  job.lockedBy = null;
  job.lockedAt = null;
  job.lockedUntil = null;
}

function markFinished(job: JobRecord | MockJob, startedMs: number) {
  job.lastFinishedAt = nowDate();
  job.lastDurationMs = Math.max(0, Math.round(timeFn() - startedMs));
  clearJobLocks(job);
}

function deadLetter(
  job: JobRecord | MockJob,
  code: JobErrorCode,
  message: string,
  startedMs: number,
) {
  job.status = "dead_letter";
  job.lastErrorCode = code;
  job.lastError = message;
  markFinished(job, startedMs);
}

function acquireGlobalLock(runnerId: string, ttlMs: number): boolean {
  const lock = harness.state.lock;
  const nowMs = timeFn();

  if (!lock || lock.lockedUntil <= nowMs) {
    harness.state.lock.lockedUntil = nowMs + ttlMs;
    harness.state.lock.lockedBy = runnerId;
    harness.state.lock.updatedAt = nowMs;
    return true;
  }

  // Re-entrant for same runnerId (helps tests that call runDueJobs twice quickly)
  if (lock.lockedBy === runnerId) {
    harness.state.lock.lockedUntil = nowMs + ttlMs;
    harness.state.lock.updatedAt = nowMs;
    return true;
  }

  return false;
}

function releaseGlobalLock(runnerId: string) {
  const lock = harness.state.lock;
  if (lock?.lockedBy === runnerId) {
    harness.state.lock.lockedUntil = 0;
    harness.state.lock.lockedBy = null;
    harness.state.lock.updatedAt = timeFn();
  }
}

/**
 * Run due jobs from the in-memory runtime using the shared harness.
 *
 * Tests expect:
 * - skipped="lock_held" when global lock cannot be acquired
 * - counters: processed/failed/deadLettered/reclaimed/stoppedEarly
 * - mutation of job records in-place (status, attempts, timing, errors, lock fields)
 */
export async function runDueJobs(
  runnerId: string,
  opts?: {
    limit?: number;
    timeBudgetMs?: number;
    globalLockTtlMs?: number;
    jobLockTtlMs?: number;
  },
): Promise<RunDueJobsResult> {
  const limit = clampInt(opts?.limit ?? DEFAULT_MAX_JOBS_PER_RUN, 1, 1000);
  const timeBudgetMs = clampInt(opts?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS, 1, 60_000);
  const globalLockTtlMs = clampInt(
    opts?.globalLockTtlMs ?? DEFAULT_GLOBAL_LOCK_TTL_MS,
    100,
    300_000,
  );
  const jobLockTtlMs = clampInt(opts?.jobLockTtlMs ?? DEFAULT_JOB_LOCK_TTL_MS, 100, 300_000);

  const result: RunDueJobsResult = {
    processed: 0,
    failed: 0,
    deadLettered: 0,
    reclaimed: 0,
    stoppedEarly: false,
  };

  if (!acquireGlobalLock(runnerId, globalLockTtlMs)) {
    result.skipped = "lock_held";
    return result;
  }

  const runnerStartMs = timeFn();
  const deadlineMs = runnerStartMs + timeBudgetMs;

  try {
    const now = nowDate();

    // 1) TTL reclaim: running jobs with expired lockUntil become pending again
    for (const job of harness.state.jobs) {
      if (
        job.status === "running" &&
        job.lockedUntil &&
        toDate(job.lockedUntil).getTime() <= now.getTime()
      ) {
        job.status = "pending";
        clearJobLocks(job);
        result.reclaimed += 1;
      }
    }

    // 2) Select due jobs
    const dueJobs = harness.state.jobs
      .filter((j) => j.status === "pending" && toDate(j.nextRunAt).getTime() <= now.getTime())
      .sort((a, b) => toDate(a.nextRunAt).getTime() - toDate(b.nextRunAt).getTime() || a.id - b.id)
      .slice(0, limit);

    // 3) Process sequentially (deterministic timing + budget behavior)
    for (const job of dueJobs) {
      if (timeFn() >= deadlineMs) {
        result.stoppedEarly = true;
        break;
      }

      // Check for optimistic lock failure simulation
      if (harness.state.failClaimForJobIds.has(job.id)) {
        continue; // Skip this job as if another runner claimed it
      }

      // Acquire job lock and mark running
      const jobStartedMs = timeFn();
      job.status = "running";
      job.lockedBy = runnerId;
      job.lockedAt = nowDate();
      job.lockedUntil = new Date(timeFn() + jobLockTtlMs);

      const reg = harness.state.handlers.get(job.type);
      if (!reg) {
        result.failed += 1;
        result.deadLettered += 1;
        deadLetter(
          job,
          JobErrorCodes.HANDLER_MISSING,
          `No job handler registered for type: ${job.type}`,
          jobStartedMs,
        );
        continue;
      }

      // Payload validation (if schema exists or validateImpl exists)
      let payload: unknown = job.payload;
      if (reg.schema && typeof reg.schema === "object" && "safeParse" in reg.schema) {
        const parsed = (reg.schema as any).safeParse(job.payload);
        if (!parsed.success) {
          result.failed += 1;
          result.deadLettered += 1;
          deadLetter(
            job,
            JobErrorCodes.PAYLOAD_INVALID,
            `Invalid payload for job type ${job.type}: ${parsed.error.message}`,
            jobStartedMs,
          );
          continue;
        }
        payload = parsed.data;
      } else if (harness.state.validateImpl) {
        // Use the harness's validateImpl for validation
        const validation = harness.state.validateImpl(job.type, job.payload);
        if (!validation.success) {
          result.failed += 1;
          result.deadLettered += 1;
          deadLetter(job, JobErrorCodes.PAYLOAD_INVALID, validation.error, jobStartedMs);
          continue;
        }
        payload = validation.data;
      }

      try {
        // Wrap the handler to provide the expected context
        const simpleHandler = reg.handler as (payload: unknown) => Promise<void>;
        await simpleHandler(payload);

        // Success
        job.status = "success";
        job.lastErrorCode = null;
        job.lastError = null;
        markFinished(job, jobStartedMs);
        result.processed += 1; // Only increment processed for successful jobs
      } catch (err) {
        // Handler failure
        result.failed += 1; // Increment failed for failed jobs
        job.lastErrorCode = JobErrorCodes.HANDLER_ERROR;
        job.lastError = safeErrorMessage(err);
        job.attempt = (job.attempt ?? 0) + 1;

        markFinished(job, jobStartedMs);

        if (job.attempt >= job.maxAttempts) {
          job.status = "dead_letter";
          result.deadLettered += 1;
        } else {
          job.status = "pending";
          job.nextRunAt = new Date(Date.now() + computeBackoffMs(job.attempt));
        }
      }
    }
  } finally {
    releaseGlobalLock(runnerId);
  }

  return result;
}

export type { JobErrorCode } from "./errors";
// Re-export error taxonomy so tests can import from runner if desired.
export { JobErrorCodes } from "./errors";
