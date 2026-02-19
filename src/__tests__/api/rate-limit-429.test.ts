/**
 * Rate limit 429 response envelope test.
 * Verifies that when rate limit is exceeded, the response has the normalized error envelope.
 */

import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

// Stub Sentry — its SDK initialization hangs in happy-dom.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/api/request-id", () => ({
  getRequestId: () => "test-request-id",
  extractOrGenerateRequestId: () => "test-request-id",
  runWithRequestIdAsync: async (_id: string, fn: () => Promise<unknown>) => fn(),
  setRequestContext: vi.fn(),
  getRequestContext: () => undefined,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: false,
    headers: {
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1234567890",
    },
  }),
}));

// Static import — vi.mock calls above are hoisted before this resolves.
import { withRateLimit } from "@/lib/api-rate-limit";

describe("Rate limit 429 envelope", () => {
  it("returns 429 with normalized envelope when rate limit exceeded", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports/abc123");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));

    const res = await withRateLimit(req, handler, { customTier: "anonymous" });

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(data.error.message).toBeDefined();
    expect(data.error.requestId).toBeDefined();
    expect(res.headers.get("x-request-id")).toBeDefined();
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
  });
});
