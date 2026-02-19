/**
 * Failure-mode chaos tests — system behaves correctly under partial failure.
 * Each returns normalized error envelope, no unhandled rejections, no 500s for expected failures.
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
    headers: { "X-RateLimit-Limit": "30", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "0" },
  }),
}));

import { withRateLimit } from "@/lib/api-rate-limit";

describe("Failure-mode chaos", () => {
  it("rate limit returns 429 with normalized envelope", async () => {
    const req = new NextRequest("http://localhost/api/test");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));

    const res = await withRateLimit(req, handler, { customTier: "anonymous" });

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(data.error.message).toBeDefined();
    expect(data.error.requestId).toBeDefined();
  });

  it("apiError returns normalized envelope shape", async () => {
    const { apiError } = await import("@/lib/api/errors");

    const res = apiError("NOT_FOUND", "Resource not found", 404);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("NOT_FOUND");
    expect(data.error.message).toBe("Resource not found");
    expect(res.headers.get("x-request-id")).toBeDefined();
  });

  it("validationError returns normalized envelope", async () => {
    const { validationError } = await import("@/lib/api/errors");

    const res = validationError("Invalid body");
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(res.status).toBe(400);
  });
});
