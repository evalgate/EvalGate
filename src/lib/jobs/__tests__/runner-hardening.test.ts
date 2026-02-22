/**
 * Runner hardening tests — overlap lock, TTL reclaim, payload validation,
 * missing handler, time budget, timing fields.
 *
 * FIXES:
 *  - exports WebhookDeliveryError from "../handlers/webhook-delivery" mock
 *  - drizzle-orm mock includes `or`
 *  - stateful DB mock supports lock + jobs updates
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobErrorCodes } from "../types";

import { harness, setupJobsTestHarness } from "./mocks/jobs-harness";

// Set up mocks BEFORE unknown imports
vi.mock("../handlers/webhook-delivery", () => {
  class WebhookDeliveryError extends Error {
    errorCode: string;
    retryAfterMs?: number;
    constructor(message: string, errorCode: string, retryAfterMs?: number) {
      super(message);
      this.name = "WebhookDeliveryError";
      this.errorCode = errorCode;
      this.retryAfterMs = retryAfterMs;
    }
  }

  return {
    WebhookDeliveryError,
    handleWebhookDelivery: (payload: unknown) => harness.state.handlerImpl(payload),
  };
});

setupJobsTestHarness();
beforeEach(() => harness.reset());

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ✅ MUST export WebhookDeliveryError because runner.ts imports it for instanceof
vi.mock("../payload-schemas", () => ({
  validatePayload: (type: string, payload: unknown) => {
    if (harness.state.validateImpl) return harness.state.validateImpl(type, payload);
    const p = payload as Record<string, unknown>;
    if (p?.webhookId && p?.organizationId && p?.event && p?.timestamp !== undefined) {
      return { success: true, data: p };
    }
    return { success: false, error: "webhookId: Required" };
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }), // ✅ required by runner
  eq: (col: unknown, val: unknown) => ({ _eq: { col, val } }),
  lt: (col: unknown, val: unknown) => ({ _lt: { col, val } }),
  lte: (col: unknown, val: unknown) => ({ _lte: { col, val } }),
  sql: (s: unknown) => s,
}));

vi.mock("@/db/schema", () => ({
  jobs: {
    id: "id",
    type: "type",
    payload: "payload",
    status: "status",
    attempt: "attempt",
    maxAttempts: "maxAttempts",
    nextRunAt: "nextRunAt",
    lockedAt: "lockedAt",
    lockedUntil: "lockedUntil",
    lockedBy: "lockedBy",
    lastStartedAt: "lastStartedAt",
    lastFinishedAt: "lastFinishedAt",
    lastDurationMs: "lastDurationMs",
    lastError: "lastError",
    lastErrorCode: "lastErrorCode",
    organizationId: "organizationId",
    updatedAt: "updatedAt",
  },
  jobRunnerLocks: {
    lockName: "lockName",
    lockedUntil: "lockedUntil",
    lockedBy: "lockedBy",
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/db", () => {
  function flatCond(cond: unknown): Array<Record<string, unknown>> {
    if (!cond || typeof cond !== "object") return [];
    const c = cond as Record<string, unknown>;
    if (Array.isArray(c._and)) return (c._and as unknown[]).flatMap(flatCond);
    // NOTE: we don't need to flatten _or for these tests
    return [c];
  }

  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: (_cond: unknown) => ({
            limit: async (n: number) => {
              if (table?.lockName !== undefined) {
                return [{ ...harness.state.lock }];
              }

              return harness.state.jobs
                .filter((j) => j.status === "pending" && j.nextRunAt <= new Date())
                .slice(0, n)
                .map((j) => ({
                  id: j.id,
                  type: j.type,
                  payload: j.payload,
                  attempt: j.attempt,
                  maxAttempts: j.maxAttempts,
                }));
            },
          }),
        }),
      }),

      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            async function exec(): Promise<unknown[]> {
              const preds = flatCond(cond);

              const getEq = (col: string) => {
                const p = preds.find((x) => x._eq?.col === col);
                return p ? p._eq.val : undefined;
              };
              const getLt = (col: string) => {
                const p = preds.find((x) => x._lt?.col === col);
                return p ? p._lt.val : undefined;
              };

              // ── jobRunnerLocks ────────────────────────────────────────
              if (table?.lockName !== undefined) {
                if (getEq("lockName") !== "default") return [];

                // acquire attempt
                if (typeof values.lockedUntil === "number" && values.lockedUntil > 0) {
                  const nowMs = (getLt("lockedUntil") as number) ?? Date.now();
                  if (harness.state.lock.lockedUntil < nowMs) {
                    harness.state.lock.lockedUntil = values.lockedUntil;
                    harness.state.lock.lockedBy = values.lockedBy ?? null;
                    harness.state.lock.updatedAt = values.updatedAt ?? Date.now();
                    return [{ lockName: "default" }];
                  }
                  return [];
                }

                // release
                if (values.lockedUntil === 0) {
                  const byVal = getEq("lockedBy");
                  if (byVal !== undefined && harness.state.lock.lockedBy !== byVal) return [];
                  harness.state.lock.lockedUntil = 0;
                  harness.state.lock.lockedBy = null;
                  return [{ lockName: "default" }];
                }

                return [];
              }

              // ── jobs table updates ───────────────────────────────────────────
              const jobId = getEq("id") as number | undefined;
              if (jobId === undefined) return [];

              // Detect a "claim" update by values shape:
              const looksLikeClaim =
                (values.lockedBy !== undefined || values.lockedAt !== undefined) &&
                values.lockedUntil !== undefined;

              if (looksLikeClaim && harness.state.failClaimForJobIds.has(jobId)) {
                return []; // simulate claim failure
              }

              const job = harness.state.jobs.find((j) => j.id === jobId);
              if (!job) return [];

              // optimistic claim guard
              if (getEq("status") === "pending" && job.status !== "pending") return [];

              Object.assign(job, values);
              return [{ id: job.id }];
            }

            let cached: Promise<unknown[]> | null = null;
            const run = () => (cached ??= exec());

            return run();
          },
        }),
      }),
    },
  };
});

// ── Import runner after mocks ────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 1;
function makeJob(overrides: Partial<unknown> = {}): unknown {
  return harness.makeJob({ id: _id++, ...overrides });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runDueJobs — hardening", () => {
  beforeEach(() => {
    harness.state.jobs = [];
    harness.state.lock = { lockedUntil: 0, lockedBy: null, updatedAt: 0 };
    harness.state.handlerImpl = async () => {};
    harness.state.validateImpl = null;
    _id = 1;

    // Register the default webhook handler
    harness.registerHandler("webhook_delivery", {
      handler: harness.state.handlerImpl,
    });
  });

  describe("global lock", () => {
    it("returns skipped:lock_held when lock is held", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      harness.state.lock = {
        lockedUntil: Date.now() + 60_000,
        lockedBy: "other",
        updatedAt: Date.now(),
      };
      const result = await runDueJobs("test-runner");
      expect(result.skipped).toBe("lock_held");
      expect(result.processed).toBe(0);
    });

    it("acquires lock and processes jobs when lock is free", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      harness.state.jobs.push(makeJob());
      const result = await runDueJobs("test-runner");
      expect(result.skipped).toBeUndefined();
      expect(result.processed).toBe(1);
    });
  });

  describe("TTL reclaim", () => {
    it("reclaims expired running jobs", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      harness.state.jobs.push(
        makeJob({
          status: "running",
          lockedUntil: new Date(Date.now() - 1000),
          lockedBy: "crashed-runner",
        }),
      );
      const result = await runDueJobs("test-runner");
      expect(result.reclaimed).toBe(1);
    });
  });

  describe("payload validation", () => {
    it("dead-letters with JOB_PAYLOAD_INVALID for invalid payload", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      harness.state.validateImpl = () => ({ success: false, error: "webhookId: Required" });
      const job = makeJob({ payload: { bad: true } as unknown });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.deadLettered).toBe(1);
      expect(result.failed).toBe(1);
      expect(job.status).toBe("dead_letter");
      expect(job.lastErrorCode).toBe(JobErrorCodes.PAYLOAD_INVALID);
      expect(job.lockedAt).toBeNull();
      expect(job.lockedUntil).toBeNull();
      expect(job.lockedBy).toBeNull();
    });
  });

  describe("missing handler", () => {
    it("dead-letters with JOB_HANDLER_MISSING for unknown type", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      const job = makeJob({
        type: "unknown_type",
        payload: {
          webhookId: 1,
          organizationId: 1,
          event: "x",
          data: {},
          timestamp: "t",
        } as unknown,
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.deadLettered).toBe(1);
      expect(job.status).toBe("dead_letter");
      expect(job.lastErrorCode).toBe(JobErrorCodes.HANDLER_MISSING);
    });
  });

  describe("timing fields", () => {
    it("sets lastFinishedAt, lastDurationMs, clears lock fields on success", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      const job = makeJob();
      harness.state.jobs.push(job);

      await runDueJobs("test-runner");

      expect(job.status).toBe("success");
      expect(job.lastFinishedAt).not.toBeNull();
      expect(typeof job.lastDurationMs).toBe("number");
      expect(job.lastDurationMs).toBeGreaterThanOrEqual(0);
      expect(job.lockedAt).toBeNull();
      expect(job.lockedUntil).toBeNull();
      expect(job.lockedBy).toBeNull();
    });

    it("sets lastErrorCode=JOB_HANDLER_ERROR on handler failure", async () => {
      const { runDueJobs } = await import("../runner-in-memory");
      harness.state.handlerImpl = async () => {
        throw new Error("handler boom");
      };
      // Re-register the handler with the new throwing implementation
      harness.registerHandler("webhook_delivery", {
        handler: harness.state.handlerImpl,
      });
      const job = makeJob({ maxAttempts: 5 });
      harness.state.jobs.push(job);

      await runDueJobs("test-runner");

      expect(job.lastErrorCode).toBe(JobErrorCodes.HANDLER_ERROR);
      expect(job.lastError).toContain("handler boom");
    });
  });

  describe("time budget", () => {
    it("stops early when budget is exhausted", async () => {
      const { runDueJobs, setTimeFn } = await import("../runner-in-memory");
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // Create a time variable that tracks the fake time
      let currentTime = startTime;
      setTimeFn(() => currentTime);

      for (let i = 0; i < 5; i++) harness.state.jobs.push(makeJob({ id: i + 1 }));

      harness.state.handlerImpl = async () => {
        vi.advanceTimersByTime(6000);
        currentTime += 6000; // Update our time tracking
      };

      // Re-register the handler with the new implementation
      harness.registerHandler("webhook_delivery", {
        handler: harness.state.handlerImpl,
      });

      const result = await runDueJobs("test-runner");

      vi.useRealTimers();

      expect(result.stoppedEarly).toBe(true);
      expect(result.processed).toBeLessThan(5);
    });
  });

  describe("RunnerResult shape", () => {
    it("returns all expected fields", async () => {
      const { runDueJobs } = await import("../runner");
      const result = await runDueJobs("test-runner");
      expect(result).toMatchObject({
        processed: expect.any(Number),
        failed: expect.any(Number),
        reclaimed: expect.any(Number),
        deadLettered: expect.any(Number),
        stoppedEarly: expect.any(Boolean),
        runtimeMs: expect.any(Number),
      });
    });
  });
});
