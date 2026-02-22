// src/__tests__/api/developer/api-keys.route.test.ts

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  insertReturning: vi.fn(),
  selectReturning: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: h.insertReturning,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => h.selectReturning()),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: unknown, opts?: unknown) => {
    return async (req: NextRequest) => {
      // default ctx can be overridden per-test by setting globalThis.__ctx
      const ctx = (globalThis as { __ctx?: Record<string, unknown> }).__ctx ?? {
        userId: "u1",
        organizationId: 1,
        role: "member",
        scopes: ["*"],
        authType: "session",
      };

      // Handle minRole option
      if ((opts as any)?.minRole === "admin") {
        const allowed = ctx.role === "admin" || ctx.role === "owner";
        if (!allowed) {
          return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // munknown routes accept (req, ctx), some accept (req, ctx, params)
      return (handler as any)(req, ctx, {});
    };
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// If your route hashes keys, stub crypto randomness predictably
vi.mock("crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("crypto")>();
  return {
    ...original,
    randomBytes: () => Buffer.from("a".repeat(32)),
    createHash: original.createHash,
  };
});

const { POST } = await import("@/app/api/developer/api-keys/route");

describe("POST /api/developer/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { __ctx?: Record<string, unknown> | undefined }).__ctx = undefined;
  });

  it("returns 403 when user is not admin", async () => {
    (globalThis as { __ctx?: Record<string, unknown> }).__ctx = {
      userId: "u1",
      organizationId: 1,
      role: "member",
      scopes: ["api_keys:write"],
      authType: "session",
    };

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key", scopes: ["eval:read"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when wildcard scope is requested", async () => {
    (globalThis as { __ctx?: Record<string, unknown> }).__ctx = {
      userId: "u1",
      organizationId: 1,
      role: "admin",
      scopes: ["api_keys:write", "eval:read"],
      authType: "session",
    };

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key", scopes: ["*"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBeTruthy();
  });

  it("returns 201 and shows full key once on success", async () => {
    (globalThis as { __ctx?: Record<string, unknown> }).__ctx = {
      userId: "u1",
      organizationId: 1,
      role: "admin",
      scopes: ["api_keys:write", "eval:read"],
      authType: "session",
    };

    h.insertReturning.mockResolvedValueOnce([
      {
        id: 123,
        name: "Key",
        scopes: JSON.stringify(["eval:read"]),
        prefix: "sk_test_aaaaaaaa",
      },
    ]);

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key", scopes: ["eval:read"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    // Your handler should return the *full* key once.
    expect(body.key || body.apiKey || body.secretKey).toBeTruthy();
  });
});
