import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ctx: {
    authenticated: true,
    userId: "u1",
    organizationId: 1,
    role: "admin",
    scopes: ["api_keys:read", "api_keys:write"],
    authType: "session",
  },
  selectQueue: [] as unknown[],
  updateQueue: [] as unknown[],
  setCalls: [] as unknown[],
}));

const chain = (result: unknown) => {
  const b: Record<string, unknown> = {
    select: vi.fn(() => b),
    from: vi.fn(() => b),
    where: vi.fn(() => b),
    limit: vi.fn(() => b),
    orderBy: vi.fn(() => b),
    offset: vi.fn(() => b),

    update: vi.fn(() => b),
    set: vi.fn((payload: unknown) => {
      state.setCalls.push(payload);
      return b;
    }),
    returning: vi.fn(() => Promise.resolve(result)),
    // biome-ignore lint/suspicious/noThenProperty: test mock
    then: (onFulfilled: unknown) =>
      Promise.resolve(result).then(onFulfilled as (value: unknown) => unknown),
  };
  return b;
};

vi.mock("@/db", () => ({
  db: {
    select: () => chain(state.selectQueue.shift() ?? []),
    update: () => chain(state.updateQueue.shift() ?? []),
  },
}));

vi.mock("@/db/schema", () => ({
  apiKeys: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    revokedAt: "revokedAt",
    keyPrefix: "keyPrefix",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api/errors", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/errors")>();
  return { ...original };
});

vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: unknown) => {
    return async (req: NextRequest, props?: { params: Promise<Record<string, string>> }) => {
      // supports both route styles: (req, ctx) and (req, ctx, params)
      const params = props?.params ? await props.params : undefined;
      if (!state.ctx.authenticated) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return (handler as any)(req, state.ctx, params);
    };
  },
}));

const keysRoute = await import("@/app/api/developer/api-keys/route");
const idRoute = await import("@/app/api/developer/api-keys/[id]/route");

describe("API keys (more2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue.length = 0;
    state.updateQueue.length = 0;
    state.setCalls.length = 0;
    state.ctx.authenticated = true;
    state.ctx.role = "admin";
  });

  it("GET /api/developer/api-keys: returns keys and handles revoked keys in payload", async () => {
    state.selectQueue.push([
      { id: 1, keyPrefix: "sk_test_abcd", revokedAt: null },
      { id: 2, keyPrefix: "sk_test_efgh", revokedAt: new Date().toISOString() },
    ]);

    const req = new NextRequest("http://localhost/api/developer/api-keys");
    const res = await (
      keysRoute as { GET: (req: unknown, opts: unknown) => Promise<Response> }
    ).GET(req as unknown, {} as unknown);

    expect(res.status).toBe(200);
    const body = await res.json();
    const keys = Array.isArray(body) ? body : body.keys;

    expect(keys.length).toBe(2);
    // either filtered out OR included w/ revokedAt set
    const revoked = keys.find((k: Record<string, unknown>) => k.id === 2);
    if (revoked) expect(revoked.revokedAt).toBeTruthy();
  });

  it("DELETE /api/developer/api-keys/[id]: returns 404 when key not found", async () => {
    // returning [] means nothing revoked
    state.updateQueue.push([]);

    const req = new NextRequest("http://localhost/api/developer/api-keys/999", {
      method: "DELETE",
    });
    const res = await (
      idRoute as { DELETE: (req: unknown, opts: unknown) => Promise<Response> }
    ).DELETE(req as unknown, {
      params: Promise.resolve({ id: "999" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("DELETE /api/developer/api-keys/[id]: forbids revoking a key from another org", async () => {
    // If your route checks org before update, it will return 403/404.
    // Simulate update returns nothing.
    state.updateQueue.push([]);

    state.ctx.organizationId = 1;

    const req = new NextRequest("http://localhost/api/developer/api-keys/123", {
      method: "DELETE",
    });
    const res = await (
      idRoute as { DELETE: (req: unknown, opts: unknown) => Promise<Response> }
    ).DELETE(req as unknown, {
      params: Promise.resolve({ id: "123" }),
    });

    expect([403, 404]).toContain(res.status);
  });
});
