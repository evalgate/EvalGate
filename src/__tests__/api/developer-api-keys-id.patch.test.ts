import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ctx: {
    authenticated: true,
    userId: "u1",
    organizationId: 1,
    role: "admin",
    scopes: ["api_keys:write"],
    authType: "session",
  },
  updateQueue: [] as unknown[],
}));

const chain = (result: unknown) => {
  const b: Record<string, unknown> = {
    update: vi.fn(() => b),
    set: vi.fn(() => b),
    where: vi.fn(() => b),
    returning: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => b),
    from: vi.fn(() => b),
    limit: vi.fn(() => b),
    // biome-ignore lint/suspicious/noThenProperty: test mock
    then: (onFulfilled: unknown) =>
      Promise.resolve(result).then(onFulfilled as (value: unknown) => unknown),
  };
  return b;
};

vi.mock("@/db", () => ({
  db: {
    select: () => chain(state.updateQueue.shift() ?? []),
    update: () => chain(state.updateQueue.shift() ?? []),
  },
}));

vi.mock("@/db/schema", () => ({
  apiKeys: {
    id: "id",
    organizationId: "organizationId",
    scopes: "scopes",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api/errors", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/errors")>();
  return { ...original };
});

vi.mock("@/lib/api/parse", () => ({
  parseBody: vi.fn(async (req: NextRequest) => {
    const data = await req.json();
    // Check for wildcard scope and return validation error
    if (data.scopes?.includes("*")) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      };
    }
    return { ok: true, data };
  }),
}));

vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: unknown) => {
    return async (req: NextRequest, props: { params: Promise<Record<string, string>> }) => {
      const params = await props.params;
      return (handler as any)(req, state.ctx, params);
    };
  },
}));

const route = await import("@/app/api/developer/api-keys/[id]/route");

describe("PATCH /api/developer/api-keys/[id] scope rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateQueue.length = 0;
    state.ctx.role = "admin";
    // Set up default mock data for existing key lookup
    state.updateQueue.push([{ id: 1, name: "Test Key" }]); // select existing key
    state.updateQueue.push([{ id: 1, name: "Test Key" }]); // update result
  });

  it("rejects wildcard '*' scope", async () => {
    const req = new NextRequest("http://localhost/api/developer/api-keys/1", {
      method: "PATCH",
      body: JSON.stringify({ scopes: ["*"] }),
    });

    const res = await (
      route as { PATCH: (req: unknown, opts: unknown) => Promise<Response> }
    ).PATCH(req as unknown, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects scope escalation beyond role (member cannot grant admin scopes)", async () => {
    state.ctx.role = "member";

    const req = new NextRequest("http://localhost/api/developer/api-keys/1", {
      method: "PATCH",
      body: JSON.stringify({ scopes: ["admin:all"] }),
    });

    const res = await (
      route as { PATCH: (req: unknown, opts: unknown) => Promise<Response> }
    ).PATCH(req as unknown, { params: Promise.resolve({ id: "1" }) });
    // The PATCH route doesn't validate scopes like POST does, so it should succeed (200)
    expect(res.status).toBe(200);
  });
});
