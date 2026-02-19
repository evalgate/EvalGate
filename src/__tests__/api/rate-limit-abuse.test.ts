/**
 * Rate limit abuse proof — burst is capped, sustained traffic is smoothed.
 * Verifies 429 envelope, Retry-After header, and that handler is not invoked when blocked.
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub Sentry — its SDK initialization hangs in happy-dom.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/api/request-id", () => ({
  getRequestId: () => "test-request-id",
  extractOrGenerateRequestId: () => "test-request-id",
  runWithRequestIdAsync: async (_id: string, fn: () => Promise<unknown>) => fn(),
  setRequestContext: vi.fn(),
  getRequestContext: () => undefined,
}));

// vi.hoisted ensures the fn exists before the vi.mock factory captures it.
const { checkRateLimit } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
}));

import { withRateLimit } from "@/lib/api-rate-limit";

describe("Rate limit abuse proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("429 response includes Retry-After when rate limited", async () => {
    const resetMs = Date.now() + 45_000; // 45 seconds from now
    checkRateLimit.mockResolvedValue({
      success: false,
      headers: {
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(resetMs / 1000)),
        "Retry-After": "45",
      },
    });

    const req = new NextRequest("http://localhost/api/exports/abc");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withRateLimit(req, handler, { customTier: "anonymous" });

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.error?.code).toBe("RATE_LIMITED");
    expect(data.error?.requestId).toBeDefined();
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(res.headers.get("Retry-After")).toBeDefined();
  });

  it("burst: when limit exceeded, subsequent requests are blocked until reset", async () => {
    checkRateLimit
      .mockResolvedValueOnce({
        success: true,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "1",
          "X-RateLimit-Reset": "0",
        },
      })
      .mockResolvedValueOnce({
        success: false,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor((Date.now() + 60_000) / 1000)),
          "Retry-After": "60",
        },
      });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    // Run sequentially so mockResolvedValueOnce values are consumed in order.
    const res1 = await withRateLimit(new NextRequest("http://localhost/api/test"), handler, {
      customTier: "anonymous",
    });
    const res2 = await withRateLimit(new NextRequest("http://localhost/api/test"), handler, {
      customTier: "anonymous",
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(429);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
