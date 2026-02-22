import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { secureRoute } from "./secure-route";

vi.mock("@/lib/api/request-id", () => ({
  extractOrGenerateRequestId: () => "00000000-0000-0000-0000-000000000000",
  runWithRequestIdAsync: async (_id: string, fn: () => Promise<unknown>) => fn(),
  setRequestContext: () => undefined,
  getRequestContext: () => null,
  getRequestId: () => "00000000-0000-0000-0000-000000000000",
}));

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn(async (_req: unknown, handler: (req: unknown) => Promise<NextResponse>) =>
    handler(_req),
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/autumn-server", () => ({
  requireAuth: vi.fn(),
  requireAuthWithOrg: vi.fn(),
}));

const makeRequest = (options?: { authHeader?: string; path?: string; method?: string }) =>
  ({
    headers: new Headers(options?.authHeader ? { authorization: options.authHeader } : {}),
    nextUrl: new URL(options?.path ?? "http://localhost/api/test"),
    method: options?.method ?? "GET",
  }) as unknown as Request & { nextUrl: URL };

describe("secureRoute (priority tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows anonymous handlers to execute without auth", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = secureRoute(handler, { allowAnonymous: true, rateLimit: "anonymous" });
    const res = await route(makeRequest(), { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalledTimes(1);
    const firstCall = handler.mock.calls[0] as any[];
    if (firstCall && firstCall.length > 0) {
      expect(firstCall[0]).toBeDefined();
      if (firstCall.length > 1) {
        expect(firstCall[1]).toEqual({ authType: "anonymous" });
      }
    }
    expect(res.headers.get("x-request-id")).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("bubbles requireAuthWithOrg denial into an apiError response", async () => {
    const { requireAuthWithOrg } = await import("@/lib/autumn-server");
    const response = new Response(JSON.stringify({ code: "UNAUTHORIZED", error: "nope" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(requireAuthWithOrg).mockResolvedValue({ authenticated: false, response });

    const route = secureRoute(async () => NextResponse.json({ ok: true }));
    const res = await route(makeRequest({ authHeader: "Bearer token" }), {
      params: Promise.resolve({}),
    });

    expect((res as Response).status).toBe(401);
    const body = await (res as Response).json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("returns FORBIDDEN when required scopes are missing", async () => {
    const { requireAuthWithOrg } = await import("@/lib/autumn-server");
    vi.mocked(requireAuthWithOrg).mockResolvedValue({
      authenticated: true,
      userId: "user",
      organizationId: 1,
      role: "member",
      scopes: ["runs:read"],
      authType: "session",
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = secureRoute(handler, { requiredScopes: ["runs:write"] });
    const res = await route(makeRequest({ authHeader: "Bearer token" }), {
      params: Promise.resolve({}),
    });

    expect((res as Response).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = await (res as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("Insufficient scope");
  });

  it("enforces minRole requirements", async () => {
    const { requireAuthWithOrg } = await import("@/lib/autumn-server");
    vi.mocked(requireAuthWithOrg).mockResolvedValue({
      authenticated: true,
      userId: "user",
      organizationId: 1,
      role: "member",
      scopes: ["eval:read", "runs:write"],
      authType: "session",
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = secureRoute(handler, { minRole: "admin" });
    const res = await route(makeRequest({ authHeader: "Bearer token" }), {
      params: Promise.resolve({}),
    });

    expect((res as Response).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = await (res as Response).json();
    expect(body.error.message).toContain("Requires at least");
  });

  it("maps handler ZodErrors to VALIDATION_ERROR", async () => {
    const { requireAuthWithOrg } = await import("@/lib/autumn-server");
    vi.mocked(requireAuthWithOrg).mockResolvedValue({
      authenticated: true,
      userId: "user",
      organizationId: 1,
      role: "owner",
      scopes: ["eval:read"],
      authType: "session",
    });

    const handler = vi.fn(async () => {
      throw new ZodError([{ code: "custom", path: [], message: "boom" }]);
    });
    const route = secureRoute(handler);
    const res = await route(makeRequest({ authHeader: "Bearer token" }), {
      params: Promise.resolve({}),
    });

    expect((res as Response).status).toBe(400);
    const body = await (res as Response).json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("converts unexpected errors into INTERNAL_ERROR", async () => {
    const { requireAuthWithOrg } = await import("@/lib/autumn-server");
    vi.mocked(requireAuthWithOrg).mockResolvedValue({
      authenticated: true,
      userId: "user",
      organizationId: 1,
      role: "owner",
      scopes: ["eval:read"],
      authType: "session",
    });

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const route = secureRoute(handler);
    const res = await route(makeRequest({ authHeader: "Bearer token" }), {
      params: Promise.resolve({}),
    });

    expect((res as Response).status).toBe(500);
    const body = await (res as Response).json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
