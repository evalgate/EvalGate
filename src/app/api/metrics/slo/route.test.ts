/**
 * SLO Metrics Endpoint Tests
 *
 * Uses a single top-level vi.mock with a mutable response queue (_queue).
 * Each test pushes rows onto the queue; db.select() dequeues one entry per
 * call. Empty queue → [] → null values (the null-safe path).
 *
 * Query call order per route invocation (7 total):
 *   1. publicLatencyP95  — count query
 *   2. publicLatencyP95  — p95 row query  (skipped if count=0)
 *   3. authedLatencyP95  — count query
 *   4. authedLatencyP95  — p95 row query  (skipped if count=0)
 *   5. errorRate5xx      — single aggregate query
 *   6. webhookSuccessRate — single aggregate query
 *   7. evalGatePassRate  — single aggregate query
 */

import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mutable response queue ───────────────────────────────────────────────────
// Each entry is the array of rows that one db.select()...chain call returns.
const _queue: Array<Record<string, unknown>[]> = [];

const makeBuilder = (): any => {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    // Drizzle builders are thenables — awaiting them calls .then()
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle await
    then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
      Promise.resolve(_queue.shift() ?? []).then(resolve, reject),
  };
  return builder;
};

vi.mock("@/db", () => ({
  db: { select: (_fields?: any) => makeBuilder() },
}));

// Bypass secureRoute — expose the raw handler
vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: any, _opts?: any) => handler,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeReq = {} as NextRequest;
const fakeCtx = {
  userId: "u1",
  organizationId: 1,
  role: "admin" as const,
  scopes: [],
  authType: "session" as const,
};

// Import route once — vi.resetModules() would break the _queue closure
let GET: any;
beforeEach(async () => {
  _queue.length = 0;
  ({ GET } = await import("./route"));
});

async function callRoute() {
  return (GET as any)(fakeReq, fakeCtx);
}

// ── Tests ────────────────────────────────────────────────────────────────────
//
// Promise.all fires all 5 async functions simultaneously. The query call order
// within each function is sequential (count then p95 row), but the 5 functions
// interleave. In practice Node.js microtask queue processes them in start order:
//
//   Slot 1: publicLatencyP95  — count query
//   Slot 2: authedLatencyP95  — count query
//   Slot 3: errorRate5xx      — aggregate query
//   Slot 4: webhookSuccessRate — aggregate query
//   Slot 5: evalGatePassRate  — aggregate query
//   Slot 6: publicLatencyP95  — p95 row (only if count > 0)
//   Slot 7: authedLatencyP95  — p95 row (only if count > 0)

describe("GET /api/metrics/slo", () => {
  it("returns all 5 SLO keys with correct structure (empty tables)", async () => {
    const res = await callRoute();
    const data = await res.json();

    expect(data.window).toBe("24h");
    expect(typeof data.computedAt).toBe("string");

    for (const key of [
      "apiLatencyPublicP95Ms",
      "apiLatencyAuthedP95Ms",
      "errorRate5xxPct",
      "webhookSuccessRatePct",
      "evalGatePassRatePct",
    ]) {
      expect(data.slos[key]).toHaveProperty("value");
      expect(data.slos[key]).toHaveProperty("target");
      expect(data.slos[key]).toHaveProperty("breached");
    }
  });

  it("returns null values and no breaches when tables are empty", async () => {
    // Empty queue — every query returns [] → all values null
    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.apiLatencyPublicP95Ms.value).toBeNull();
    expect(data.slos.apiLatencyPublicP95Ms.breached).toBe(false);
    expect(data.slos.apiLatencyAuthedP95Ms.value).toBeNull();
    expect(data.slos.apiLatencyAuthedP95Ms.breached).toBe(false);
    expect(data.slos.errorRate5xxPct.value).toBeNull();
    expect(data.slos.errorRate5xxPct.breached).toBe(false);
    expect(data.slos.webhookSuccessRatePct.value).toBeNull();
    expect(data.slos.webhookSuccessRatePct.breached).toBe(false);
    expect(data.slos.evalGatePassRatePct.value).toBeNull();
    expect(data.slos.evalGatePassRatePct.breached).toBe(false);
  });

  it("marks public latency as breached when p95 > 800 ms", async () => {
    // Slot 1: public count=100
    // Slot 2: authed count=0 (no p95 query follows)
    // Slots 3-5: aggregate queries → []
    // Slot 6: public p95 row = 1200 ms (fires after count resolved > 0)
    _queue.push(
      [{ total: 100 }], // slot 1: public count
      [], // slot 2: authed count=0
      [], // slot 3: error rate → null
      [], // slot 4: webhook → null
      [], // slot 5: eval gate → null
      [{ responseTimeMs: 1200 }], // slot 6: public p95
    );

    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.apiLatencyPublicP95Ms.value).toBe(1200);
    expect(data.slos.apiLatencyPublicP95Ms.breached).toBe(true);
    expect(data.slos.errorRate5xxPct.value).toBeNull();
  });

  it("does not breach latency when p95 is within threshold", async () => {
    _queue.push(
      [{ total: 50 }], // public count
      [], // authed count=0
      [], // error rate → null
      [], // webhook → null
      [], // eval gate → null
      [{ responseTimeMs: 400 }], // public p95 (< 800 ms)
    );

    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.apiLatencyPublicP95Ms.value).toBe(400);
    expect(data.slos.apiLatencyPublicP95Ms.breached).toBe(false);
  });

  it("marks error rate as breached when > 2%", async () => {
    _queue.push(
      [], // public count=0
      [], // authed count=0
      [{ total: 100, errors: 3 }], // error rate = 3% > 2% threshold
      [], // webhook → null
      [], // eval gate → null
    );

    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.errorRate5xxPct.value).toBeCloseTo(3.0);
    expect(data.slos.errorRate5xxPct.breached).toBe(true);
  });

  it("marks webhook success rate as breached when < 90%", async () => {
    _queue.push(
      [], // public count=0
      [], // authed count=0
      [{ total: 100, errors: 0 }], // error rate = 0% (ok)
      [{ total: 100, successes: 85 }], // 85% < 90% → breached
      [], // eval gate → null
    );

    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.webhookSuccessRatePct.value).toBeCloseTo(85.0);
    expect(data.slos.webhookSuccessRatePct.breached).toBe(true);
  });

  it("marks eval gate pass rate as breached when < 50%", async () => {
    _queue.push(
      [], // public count=0
      [], // authed count=0
      [{ total: 100, errors: 0 }], // error rate ok
      [{ total: 100, successes: 95 }], // webhook ok
      [{ total: 100, passed: 40 }], // 40% < 50% → breached
    );

    const res = await callRoute();
    const data = await res.json();

    expect(data.slos.evalGatePassRatePct.value).toBeCloseTo(40.0);
    expect(data.slos.evalGatePassRatePct.breached).toBe(true);
  });

  it("sets Cache-Control: no-cache header", async () => {
    const res = await callRoute();
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");
  });
});
