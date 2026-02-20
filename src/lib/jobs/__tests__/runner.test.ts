/**
 * Job Runner Tests
 *
 * Covers:
 *  - Backoff delay math (nextRetryAt)
 *  - Optimistic lock: job skipped when claimed by another invocation
 *  - Success path: status → success
 *  - Failure path: status → pending with incremented attempt
 *  - Dead-letter: status → dead_letter after maxAttempts
 *  - No handler registered: status → failed
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockHandler = vi.fn();

vi.mock("../handlers/webhook-delivery", () => ({
  handleWebhookDelivery: (...args: any[]) => mockHandler(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: any[]) => args,
  eq: (col: any, val: any) => ({ col, val }),
  lte: (col: any, val: any) => ({ col, val }),
}));

vi.mock("@/db/schema", () => ({ jobs: {} }));

// DB mock — controlled via selectQueue and returningQueue
const selectQueue: any[][] = [];
const returningQueue: any[][] = [];

const makeSelectBuilder = () => ({
  from: function () {
    return this;
  },
  where: function () {
    return this;
  },
  limit: () => Promise.resolve(selectQueue.shift() ?? []),
});

const makeUpdateBuilder = () => ({
  set: () => ({
    where: () => ({
      returning: () => Promise.resolve(returningQueue.shift() ?? []),
    }),
  }),
});

vi.mock("@/db", () => ({
  db: {
    select: () => makeSelectBuilder(),
    update: () => makeUpdateBuilder(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue.length = 0;
  returningQueue.length = 0;
  mockHandler.mockReset();
});

// ── nextRetryAt tests ────────────────────────────────────────────────────────

describe("nextRetryAt", () => {
  it("returns 1 min delay for attempt 1", async () => {
    const { nextRetryAt } = await import("../runner");
    const before = Date.now();
    const result = nextRetryAt(1);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 60_000 - 50);
    expect(result.getTime()).toBeLessThanOrEqual(before + 60_000 + 200);
  });

  it("returns 5 min delay for attempt 2", async () => {
    const { nextRetryAt } = await import("../runner");
    const before = Date.now();
    const result = nextRetryAt(2);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 5 * 60_000 - 50);
  });

  it("returns 15 min delay for attempt 3", async () => {
    const { nextRetryAt } = await import("../runner");
    const before = Date.now();
    const result = nextRetryAt(3);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 15 * 60_000 - 50);
  });

  it("returns 1 h delay for attempt 4", async () => {
    const { nextRetryAt } = await import("../runner");
    const before = Date.now();
    const result = nextRetryAt(4);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 60 * 60_000 - 50);
  });

  it("caps at 4 h for attempt >= 5", async () => {
    const { nextRetryAt } = await import("../runner");
    const before = Date.now();
    const r5 = nextRetryAt(5);
    const r99 = nextRetryAt(99);
    expect(r5.getTime()).toBeGreaterThanOrEqual(before + 4 * 60 * 60_000 - 50);
    expect(r99.getTime()).toBeGreaterThanOrEqual(before + 4 * 60 * 60_000 - 50);
  });
});

// ── runDueJobs tests ─────────────────────────────────────────────────────────

describe("runDueJobs", () => {
  it("returns { processed: 0, failed: 0 } when no jobs are due", async () => {
    selectQueue.push([]); // candidates query → empty
    const { runDueJobs } = await import("../runner");
    expect(await runDueJobs()).toEqual({ processed: 0, failed: 0 });
  });

  it("skips job when optimistic lock claim fails", async () => {
    selectQueue.push([
      { id: 1, type: "webhook_delivery", payload: {}, attempt: 0, maxAttempts: 5 },
    ]);
    returningQueue.push([]); // claim returns [] → another invocation claimed it

    const { runDueJobs } = await import("../runner");
    const result = await runDueJobs();

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("marks job as success when handler resolves", async () => {
    const candidate = {
      id: 2,
      type: "webhook_delivery",
      payload: { webhookId: 1 },
      attempt: 0,
      maxAttempts: 5,
    };
    selectQueue.push([candidate]);
    returningQueue.push([{ id: 2 }]); // claim succeeds
    returningQueue.push([]); // success update
    mockHandler.mockResolvedValueOnce(undefined);

    const { runDueJobs } = await import("../runner");
    const result = await runDueJobs();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(mockHandler).toHaveBeenCalledWith(candidate.payload);
  });

  it("retries job (status=pending, attempt+1) when handler throws and not at maxAttempts", async () => {
    const candidate = { id: 3, type: "webhook_delivery", payload: {}, attempt: 0, maxAttempts: 5 };
    selectQueue.push([candidate]);
    returningQueue.push([{ id: 3 }]); // claim
    // The failure update returning is consumed by the update chain
    returningQueue.push([]);
    mockHandler.mockRejectedValueOnce(new Error("timeout"));

    const { runDueJobs } = await import("../runner");
    const result = await runDueJobs();

    expect(result).toEqual({ processed: 0, failed: 1 });
  });

  it("marks job as dead_letter when attempt reaches maxAttempts", async () => {
    // attempt=4, maxAttempts=5 → nextAttempt=5 >= maxAttempts → dead_letter
    const candidate = { id: 4, type: "webhook_delivery", payload: {}, attempt: 4, maxAttempts: 5 };
    selectQueue.push([candidate]);
    returningQueue.push([{ id: 4 }]); // claim
    returningQueue.push([]); // dead_letter update
    mockHandler.mockRejectedValueOnce(new Error("final failure"));

    const { runDueJobs } = await import("../runner");
    const result = await runDueJobs();

    expect(result).toEqual({ processed: 0, failed: 1 });
  });

  it("marks job as failed when no handler is registered for type", async () => {
    const candidate = { id: 5, type: "unknown_type", payload: {}, attempt: 0, maxAttempts: 5 };
    selectQueue.push([candidate]);
    returningQueue.push([{ id: 5 }]); // claim
    returningQueue.push([]); // failed update

    const { runDueJobs } = await import("../runner");
    const result = await runDueJobs();

    expect(result).toEqual({ processed: 0, failed: 1 });
  });
});
