import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the harness for type reference
import { harness, setupJobsTestHarness } from "@/lib/jobs/__tests__/mocks/jobs-harness";

describe("jobs/runner", () => {
  beforeEach(() => {
    vi.resetModules();
    harness.reset();

    // Setup mocks before importing the module under test
    setupJobsTestHarness();
  });

  describe("reclaim path", () => {
    it("reclaims expired running jobs and updates them to pending", async () => {
      // Import after mocks to prevent leakage
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Create a stale running job with expired lock
      const staleJob = harness.makeJob({
        id: 1001,
        status: "running",
        lockedBy: "old-runner",
        lockedAt: new Date(Date.now() - 180_000), // 3 minutes ago
        lockedUntil: new Date(Date.now() - 60_000), // 1 minute ago (expired)
        nextRunAt: new Date(Date.now() + 60_000), // Not due yet — prevents re-processing after reclaim
        lastErrorCode: null,
      });
      harness.state.jobs.push(staleJob);

      const result = await runDueJobs("test-runner");

      expect(result.reclaimed).toBe(1);
      expect(staleJob.status).toBe("pending");
      expect(staleJob.lockedBy).toBeNull();
      expect(staleJob.lockedAt).toBeNull();
      expect(staleJob.lockedUntil).toBeNull();
      expect(staleJob.lastErrorCode).toBe("JOB_LOCK_TIMEOUT_RECLAIMED");
    });

    it("does not reclaim jobs that are still within lock TTL", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Create a running job with valid lock (still in the future)
      const activeJob = harness.makeJob({
        id: 1002,
        status: "running",
        lockedBy: "active-runner",
        lockedAt: new Date(Date.now() - 30_000), // 30 seconds ago
        lockedUntil: new Date(Date.now() + 90_000), // 90 seconds from now (still valid)
      });
      harness.state.jobs.push(activeJob);

      const result = await runDueJobs("test-runner");

      expect(result.reclaimed).toBe(0);
      expect(activeJob.status).toBe("running");
      expect(activeJob.lockedBy).toBe("active-runner");
    });
  });

  describe("handler missing dead-letter", () => {
    it("dead-letters jobs with unregistered handler types", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      const job = harness.makeJob({
        id: 1003,
        type: "unknown_handler_type",
        payload: { data: "test" },
        status: "pending",
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.deadLettered).toBe(1);
      expect(result.failed).toBe(1);
      expect(job.status).toBe("dead_letter");
      expect(job.lastErrorCode).toBe("JOB_HANDLER_MISSING");
      expect(job.lastError).toContain("No handler for type: unknown_handler_type");
      expect(job.lockedBy).toBeNull();
    });
  });

  describe("payload invalid via validateImpl", () => {
    it("dead-letters jobs when payload validation fails", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Setup validation to fail
      harness.state.validateImpl = () => ({
        success: false,
        error: "Invalid webhookId: must be a positive integer",
      });

      const job = harness.makeJob({
        id: 1004,
        type: "webhook_delivery",
        payload: { webhookId: "invalid" },
        status: "pending",
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.deadLettered).toBe(1);
      expect(result.failed).toBe(1);
      expect(job.status).toBe("dead_letter");
      expect(job.lastErrorCode).toBe("JOB_PAYLOAD_INVALID");
      expect(job.lastError).toContain("Invalid webhookId: must be a positive integer");
    });

    it("processes jobs successfully when payload validation passes", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Setup validation to succeed
      harness.state.validateImpl = () => ({
        success: true,
        data: { webhookId: 123, data: "valid" },
      });

      // Setup handler to succeed
      let handledPayload: unknown = null;
      harness.state.handlerImpl = async (payload: unknown) => {
        handledPayload = payload;
      };

      const job = harness.makeJob({
        id: 1005,
        type: "webhook_delivery",
        payload: { webhookId: 123 },
        status: "pending",
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(job.status).toBe("success");
      expect(handledPayload).toEqual({ webhookId: 123, data: "valid" });
    });
  });

  describe("retry/backoff + maxAttempts", () => {
    it("retries job with exponential backoff when handler fails", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Setup handler to fail
      harness.state.handlerImpl = async () => {
        throw new Error("Temporary failure");
      };

      const job = harness.makeJob({
        id: 1006,
        type: "webhook_delivery",
        payload: { webhookId: 456 },
        status: "pending",
        attempt: 0,
        maxAttempts: 3,
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.failed).toBe(1);
      expect(result.deadLettered).toBe(0);
      expect(job.status).toBe("pending");
      expect(job.attempt).toBe(1);
      expect(job.lastErrorCode).toBe("JOB_HANDLER_ERROR");
      expect(job.lastError).toContain("Temporary failure");

      // Should have a next run time in the future (backoff)
      expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("dead-letters job when maxAttempts is exceeded", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      harness.state.handlerImpl = async () => {
        throw new Error("Persistent failure");
      };

      const job = harness.makeJob({
        id: 1007,
        type: "webhook_delivery",
        payload: { webhookId: 789 },
        status: "pending",
        attempt: 2, // Already attempted twice
        maxAttempts: 3, // This attempt will hit max
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.failed).toBe(1);
      expect(result.deadLettered).toBe(1);
      expect(job.status).toBe("dead_letter");
      expect(job.attempt).toBe(3);
      expect(job.lastErrorCode).toBe("JOB_HANDLER_ERROR");
    });

    it("uses custom retry-after from WebhookDeliveryError when available", async () => {
      const { runDueJobs, WebhookDeliveryError } = await import("@/lib/jobs/runner");

      // Import WebhookDeliveryError from the mocked module
      const { WebhookDeliveryError: MockWebhookDeliveryError } = await import(
        "@/lib/jobs/handlers/webhook-delivery"
      );

      harness.state.handlerImpl = async () => {
        throw new MockWebhookDeliveryError("Rate limited", "RATE_LIMIT", 30_000);
      };

      const job = harness.makeJob({
        id: 1008,
        type: "webhook_delivery",
        payload: { webhookId: 999 },
        status: "pending",
        attempt: 0,
        maxAttempts: 3,
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.failed).toBe(1);
      expect(job.lastErrorCode).toBe("RATE_LIMIT");

      // Should use the custom retry-after (30 seconds) instead of default backoff
      const expectedNextRun = Date.now() + 30_000;
      expect(Math.abs(job.nextRunAt.getTime() - expectedNextRun)).toBeLessThan(1000);
    });
  });

  describe("global lock skipped", () => {
    it("skips processing when global lock is held by another runner", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Hold the global lock with another runner
      harness.holdGlobalLock("other-runner", 60_000);

      const job = harness.makeJob({
        id: 1009,
        type: "webhook_delivery",
        payload: { webhookId: 111 },
        status: "pending",
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.skipped).toBe("lock_held");
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(job.status).toBe("pending"); // Unchanged
    });

    it("processes normally when global lock is available", async () => {
      const { runDueJobs } = await import("@/lib/jobs/runner");

      // Ensure lock is not held
      harness.releaseGlobalLock();

      harness.state.handlerImpl = async () => {
        // Success
      };

      const job = harness.makeJob({
        id: 1010,
        type: "webhook_delivery",
        payload: { webhookId: 222 },
        status: "pending",
      });
      harness.state.jobs.push(job);

      const result = await runDueJobs("test-runner");

      expect(result.processed).toBe(1);
      expect(job.status).toBe("success");
    });
  });

  describe("nextRetryAt utility", () => {
    it("calculates next retry time with jitter for attempt 1", async () => {
      const { nextRetryAt } = await import("@/lib/jobs/runner");

      const before = Date.now();
      const nextTime = nextRetryAt(1);
      const after = Date.now();

      // Should be approximately 1 minute (+/- 10% jitter)
      const expectedMin = before + 54_000; // 1 min - 10%
      const expectedMax = after + 66_000; // 1 min + 10%

      expect(nextTime.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextTime.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("uses default backoff for attempt numbers beyond defined values", async () => {
      const { nextRetryAt } = await import("@/lib/jobs/runner");

      const before = Date.now();
      const nextTime = nextRetryAt(10); // Beyond defined attempts
      const after = Date.now();

      // Should use attempt 5 backoff (4 hours) as default
      const expectedMin = before + 3.6 * 60 * 60 * 1000; // 4h - 10%
      const expectedMax = after + 4.4 * 60 * 60 * 1000; // 4h + 10%

      expect(nextTime.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextTime.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });
});
