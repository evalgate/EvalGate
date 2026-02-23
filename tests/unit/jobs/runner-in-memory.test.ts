import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Import the harness for type reference
import { harness, setupJobsTestHarness } from "@/lib/jobs/__tests__/mocks/jobs-harness";

describe("runner-in-memory.runDueJobs", () => {
  const runnerId = "runner-1";
  let nowMs: number;
  let mod: any;
  let h: ReturnType<
    typeof import("../../../../src/lib/jobs/runner-in-memory").createJobTestHarness
  >;

  // Import types after setup
  type JobRecord = import("../../../../src/lib/jobs/runner-in-memory").JobRecord;

  function makeDueJob(overrides: Partial<JobRecord> = {}) {
    // Ensure job is due now
    return h.makeJob({
      nextRunAt: new Date(nowMs - 1),
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.resetModules();
    harness.reset();

    // Setup mocks before importing the module under test
    setupJobsTestHarness();

    // Import AFTER mocks to prevent leakage
    mod = require("@/lib/jobs/runner-in-memory");
    h = mod.createJobTestHarness();
    h.clearHandlers();

    // Deterministic clock
    nowMs = Date.UTC(2026, 1, 22, 12, 0, 0); // Feb 22, 2026 12:00:00 UTC
    mod.setTimeFn(() => nowMs);

    // Clear global lock (just in case)
    h.releaseGlobalLock();
  });

  it("processes a due job successfully and clears locks + timing fields", async () => {
    const called: unknown[] = [];
    h.registerHandler("webhook_delivery", {
      handler: async (payload: unknown) => {
        called.push(payload);
      },
    });

    const job = makeDueJob({
      type: "webhook_delivery",
      payload: { url: "https://example.com", data: "test" },
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(called).toEqual([{ url: "https://example.com", data: "test" }]);

    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("completed");
    expect(updatedJob?.lockedUntil).toBeNull();
    expect(updatedJob?.nextRunAt).toBeNull();
  });

  it("dead-letters a job when no handler is registered", async () => {
    const job = makeDueJob({
      type: "unknown_handler",
      payload: { data: "test" },
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("dead_lettered");
    expect(updatedJob?.error).toContain("No handler registered");
  });

  it("validates payload with zod schema and dead-letters on invalid payload", async () => {
    const schema = z.object({
      url: z.string().url(),
      data: z.string(),
    });

    h.registerHandler("validated_job", {
      handler: async (payload: unknown) => {
        // This should not be called due to validation failure
      },
      validateImpl: (payload) => schema.parse(payload),
    });

    const job = makeDueJob({
      type: "validated_job",
      payload: { url: "invalid-url", data: "test" }, // Invalid URL
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("dead_lettered");
    expect(updatedJob?.error).toContain("validation");
  });

  it("retries on handler error until maxAttempts then dead-letters", async () => {
    let attempts = 0;
    h.registerHandler("flaky_job", {
      handler: async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
      },
    });

    const job = makeDueJob({
      type: "flaky_job",
      payload: {},
      maxAttempts: 3,
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("dead_lettered");
    expect(updatedJob?.attempts).toBe(3);
  });

  it("skips when global lock is held by another runner", async () => {
    // Acquire global lock with another runner
    const lockAcquired = await h.acquireGlobalLock("other-runner", 60000);
    expect(lockAcquired).toBe(true);

    const job = makeDueJob({
      type: "webhook_delivery",
      payload: {},
    });

    h.registerHandler("webhook_delivery", {
      handler: async () => {
        // Should not be called
      },
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(0);

    // Job should still be pending
    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("pending");
  });

  it("reclaims stale running jobs whose lockedUntil is expired", async () => {
    const job = makeDueJob({
      type: "webhook_delivery",
      payload: {},
      status: "running",
      lockedUntil: new Date(nowMs - 1000), // Expired 1 second ago
      lockedBy: "stale-runner",
    });

    h.registerHandler("webhook_delivery", {
      handler: async () => {
        // Should be called after reclaim
      },
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("completed");
  });

  it("simulates optimistic claim failure by skipping jobs in failClaimForJobIds", async () => {
    const job = makeDueJob({
      type: "webhook_delivery",
      payload: {},
    });

    // Simulate optimistic claim failure
    h.setFailClaimForJobIds([job.id]);

    h.registerHandler("webhook_delivery", {
      handler: async () => {
        // Should not be called
      },
    });

    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 1000 });

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(0);

    // Job should still be pending
    const updatedJob = await h.getJob(job.id);
    expect(updatedJob?.status).toBe("pending");
  });

  it("stops early when time budget is exceeded before processing all due jobs", async () => {
    // Create multiple due jobs
    const jobs = [];
    for (let i = 0; i < 5; i++) {
      jobs.push(
        makeDueJob({
          type: "webhook_delivery",
          payload: { index: i },
        }),
      );
    }

    let processedCount = 0;
    h.registerHandler("webhook_delivery", {
      handler: async () => {
        processedCount++;
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
    });

    // Very short time budget - should stop early
    const result = await mod.runDueJobs({ runnerId, timeBudgetMs: 25 });

    // Should process some but not all jobs due to time budget
    expect(result.processed).toBeLessThan(5);
    expect(result.processed).toBeGreaterThan(0);
    expect(processedCount).toBe(result.processed);
  });
});
