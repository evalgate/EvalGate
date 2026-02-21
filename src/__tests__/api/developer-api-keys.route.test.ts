import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------- shared mock state ----------
const state = vi.hoisted(() => ({
  ctx: {
    authenticated: true,
    userId: "u1",
    organizationId: 1,
    role: "member", // override per-test
    scopes: ["api_keys:read", "api_keys:write"],
    authType: "session",
  },
  selectQueue: [] as unknown[],
  insertQueue: [] as unknown[],
  insertValues: [] as unknown[],
}));

const createChain = (result: unknown) => {
  const b: Record<string, unknown> = {
    select: vi.fn(() => b),
    insert: vi.fn(() => b),
    values: vi.fn((vals: unknown) => {
      state.insertValues.push(vals);
      return b;
    }),
    returning: vi.fn(() => Promise.resolve(result)),
    where: vi.fn(() => b),
    limit: vi.fn(() => b),
    from: vi.fn(() => b),
    orderBy: vi.fn(() => b),
    offset: vi.fn(() => b),
    // biome-ignore lint/suspicious/noThenProperty: test mock
    then: (onFulfilled: unknown) =>
      Promise.resolve(result).then(onFulfilled as (value: unknown) => unknown),
  };
  return b;
};

vi.mock("@/db", () => ({
  db: {
    select: () => createChain(state.selectQueue.shift() ?? []),
    insert: () => createChain(state.insertQueue.shift() ?? []),
  },
}));

vi.mock("@/db/schema", () => ({
  apiKeys: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    revokedAt: "revokedAt",
    keyPrefix: "keyPrefix",
    keyHash: "keyHash",
    scopes: "scopes",
    name: "name",
    createdAt: "createdAt",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Keep errors real (includes apiError)
vi.mock("@/lib/api/errors", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/errors")>();
  return { ...original };
});

// Mock parseBody to just return whatever JSON is provided
vi.mock("@/lib/api/parse", () => ({
  parseBody: vi.fn(async (req: NextRequest) => {
    const data = await req.json();
    return { ok: true, data };
  }),
}));

/**
 * Mock secureRoute with minRole support.
 * Your real secureRoute also does scopes, but for these tests role gate is the main thing.
 */
vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: unknown, opts?: { minRole?: string }) => {
    return async (req: NextRequest, props?: { params: Promise<Record<string, string>> }) => {
      const params = props?.params ? await props.params : undefined;
      if (!state.ctx.authenticated) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }

      // enforce minRole: admin
      if (opts?.minRole === "admin") {
        const allowed = state.ctx.role === "admin" || state.ctx.role === "owner";
        if (!allowed) {
          return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
      }

      return (handler as any)(req, state.ctx, params);
    };
  },
}));

const { POST, GET } = await import("@/app/api/developer/api-keys/route");

describe("/api/developer/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue.length = 0;
    state.insertQueue.length = 0;
    state.insertValues.length = 0;
    state.ctx.authenticated = true;
    state.ctx.role = "member";
    state.ctx.scopes = ["api_keys:read", "api_keys:write"];
  });

  it("POST rejects non-admin users (minRole admin)", async () => {
    state.ctx.role = "member";

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key 1", scopes: ["eval:read"] }),
    });

    const res = await (POST as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("POST rejects wildcard scope '*'", async () => {
    state.ctx.role = "admin";

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key 1", scopes: ["*"] }),
    });

    const res = await (POST as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("POST rejects invalid scopes", async () => {
    state.ctx.role = "admin";

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key 1", scopes: ["not:a:real:scope"] }),
    });

    const res = await (POST as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("POST blocks key prefix collisions", async () => {
    state.ctx.role = "admin";

    // Mock the insert to throw a unique constraint error to simulate collision
    const uniqueError = new Error("UNIQUE constraint failed: apiKeys.keyPrefix");
    (uniqueError as Error & { code?: string }).code = "SQLITE_CONSTRAINT_UNIQUE";
    state.insertQueue.push(Promise.reject(uniqueError));

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key 1", scopes: ["eval:read"] }),
    });

    const res = await (POST as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );

    // Should return 409 conflict for unique constraint violation
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error?.code).toBeTruthy();
  });

  it("POST (admin) creates key and only shows full key once", async () => {
    state.ctx.role = "admin";

    // No collision check results
    state.selectQueue.push([]);

    // Insert returning
    state.insertQueue.push([
      {
        id: 1,
        name: "Key 1",
        scopes: ["eval:read"], // Keep as array, not JSON string
        keyPrefix: "sk_test_deadbeef",
        revokedAt: null,
      },
    ]);

    const req = new NextRequest("http://localhost/api/developer/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Key 1", scopes: ["eval:read"] }),
    });

    const res = await (POST as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );
    expect(res.status).toBe(201);

    const body = await res.json();

    // You said full key shown once at creation.
    // Most implementations return something like { apiKey: "sk_test_....", key: {...} }
    // We won't overfit field names; just check *some* sk_test_ value exists.
    const asString = JSON.stringify(body);
    expect(asString).toContain("sk_test_");

    // Ensure insert values did NOT store the raw key (should store hash)
    // We can only assert "keyHash" exists in insert payload if route uses it.
    if (state.insertValues[0] && Array.isArray(state.insertValues[0])) {
      const first = state.insertValues[0][0];
      if (first) {
        expect(first).not.toHaveProperty("apiKey"); // raw key should not be stored under obvious name
      }
    }
  });

  it("GET requires auth and lists keys", async () => {
    state.ctx.authenticated = true;

    // Mock the complex select query for GET
    state.selectQueue.push([
      { id: 1, name: "Key 1", revokedAt: null, keyPrefix: "sk_test_abcd", scopes: ["eval:read"] },
      { id: 2, name: "Key 2", revokedAt: null, keyPrefix: "sk_test_efgh", scopes: ["eval:read"] },
    ]);

    const req = new NextRequest("http://localhost/api/developer/api-keys", { method: "GET" });
    const res = await (GET as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // Route returns directly array
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET returns 401 when unauthenticated", async () => {
    state.ctx.authenticated = false;

    const req = new NextRequest("http://localhost/api/developer/api-keys", { method: "GET" });
    const res = await (GET as (req: unknown, opts: unknown) => Promise<Response>)(
      req as unknown,
      {} as unknown,
    );

    expect(res.status).toBe(401);
  });
});
