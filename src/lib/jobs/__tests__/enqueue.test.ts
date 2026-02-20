/**
 * enqueue() idempotency + basic insertion tests (Phase 2)
 *
 * Covers:
 *  - New job is inserted and returns an id
 *  - Duplicate idempotency key returns existing id without inserting
 *  - No idempotency key always inserts
 *  - organizationId and maxAttempts are forwarded
 *  - runAt defaults to ~now
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ──────────────────────────────────────────────────────────────────

// Mutable state
let _existingByKey: Record<string, { id: number }> = {};
let _nextId = 1;
const _inserted: any[] = [];

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ col, val }),
}));

vi.mock("@/db/schema", () => ({ jobs: {} }));

vi.mock("@/db", () => ({
  db: {
    select: (_fields?: any) => ({
      from: () => ({
        where: (cond: any) => ({
          limit: () => {
            // Simulate idempotency key lookup
            const key = cond?.val;
            const existing = _existingByKey[key];
            return Promise.resolve(existing ? [existing] : []);
          },
        }),
      }),
    }),
    insert: (_table: any) => ({
      values: (row: any) => ({
        returning: (_fields?: any) => {
          const id = _nextId++;
          _inserted.push({ ...row, id });
          // Register in key map if idempotency key provided
          if (row.idempotencyKey) {
            _existingByKey[row.idempotencyKey] = { id };
          }
          return Promise.resolve([{ id }]);
        },
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("enqueue()", () => {
  beforeEach(() => {
    _existingByKey = {};
    _nextId = 1;
    _inserted.length = 0;
  });

  it("inserts a new job and returns a numeric id", async () => {
    const { enqueue } = await import("../enqueue");
    const id = await enqueue("webhook_delivery", { webhookId: 42 });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
    expect(_inserted).toHaveLength(1);
  });

  it("returns existing id when idempotency key already exists (no duplicate insert)", async () => {
    const { enqueue } = await import("../enqueue");
    const key = "org-1-webhook-42-event-run.completed";

    const id1 = await enqueue("webhook_delivery", { webhookId: 42 }, { idempotencyKey: key });
    const id2 = await enqueue("webhook_delivery", { webhookId: 42 }, { idempotencyKey: key });

    expect(id1).toBe(id2);
    // Only one insert should have occurred
    expect(_inserted).toHaveLength(1);
  });

  it("inserts multiple jobs when no idempotency key is provided", async () => {
    const { enqueue } = await import("../enqueue");

    const id1 = await enqueue("webhook_delivery", { webhookId: 1 });
    const id2 = await enqueue("webhook_delivery", { webhookId: 2 });

    expect(id1).not.toBe(id2);
    expect(_inserted).toHaveLength(2);
  });

  it("different idempotency keys produce separate jobs", async () => {
    const { enqueue } = await import("../enqueue");

    const id1 = await enqueue("webhook_delivery", { webhookId: 1 }, { idempotencyKey: "key-a" });
    const id2 = await enqueue("webhook_delivery", { webhookId: 2 }, { idempotencyKey: "key-b" });

    expect(id1).not.toBe(id2);
    expect(_inserted).toHaveLength(2);
  });

  it("forwards organizationId to inserted row", async () => {
    const { enqueue } = await import("../enqueue");
    await enqueue("webhook_delivery", { webhookId: 5 }, { organizationId: 99 });
    expect(_inserted[0].organizationId).toBe(99);
  });

  it("forwards maxAttempts to inserted row", async () => {
    const { enqueue } = await import("../enqueue");
    await enqueue("webhook_delivery", { webhookId: 5 }, { maxAttempts: 3 });
    expect(_inserted[0].maxAttempts).toBe(3);
  });

  it("defaults maxAttempts to 5 when not specified", async () => {
    const { enqueue } = await import("../enqueue");
    await enqueue("webhook_delivery", { webhookId: 5 });
    expect(_inserted[0].maxAttempts).toBe(5);
  });

  it("nextRunAt defaults to approximately now", async () => {
    const { enqueue } = await import("../enqueue");
    const before = new Date();
    await enqueue("webhook_delivery", { webhookId: 5 });
    const after = new Date();
    const nextRunAt: Date = _inserted[0].nextRunAt;
    expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
    expect(nextRunAt.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
  });

  it("respects custom runAt option", async () => {
    const { enqueue } = await import("../enqueue");
    const future = new Date(Date.now() + 60_000);
    await enqueue("webhook_delivery", { webhookId: 5 }, { runAt: future });
    expect(_inserted[0].nextRunAt.getTime()).toBeCloseTo(future.getTime(), -2);
  });

  it("inserted job has status=pending and attempt=0", async () => {
    const { enqueue } = await import("../enqueue");
    await enqueue("webhook_delivery", { webhookId: 5 });
    expect(_inserted[0].status).toBe("pending");
    expect(_inserted[0].attempt).toBe(0);
  });
});
