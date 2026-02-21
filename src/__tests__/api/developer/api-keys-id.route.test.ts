// src/__tests__/api/developer/api-keys-id.route.test.ts

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Make sure unknown accidental db module evaluation doesn't complain about Turso.
 * (Some files log on import if these are missing.)
 */
process.env.TURSO_CONNECTION_URL = process.env.TURSO_CONNECTION_URL ?? "libsql://test";
process.env.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "test-token";

const selectQueue: unknown[] = [];

const h = vi.hoisted(() => ({
  updateReturning: vi.fn(),
}));

/**
 * Drizzle helpers used in where(and(eq())))
 */
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
  };
});

vi.mock("@/lib/api/request-id", () => ({
  getRequestId: () => "request-id",
}));

/**
 * Route usually uses api helpers like notFound()/internalError().
 * We stub them to deterministic NextResponses.
 */
vi.mock("@/lib/api/errors", () => ({
  internalError: (message = "Internal server error") =>
    NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 }),
  notFound: (message = "Not found") =>
    NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 }),
}));

/**
 * Schema exports referenced by the route.
 * (If it accesses more columns, add them here.)
 */
vi.mock("@/db/schema", () => ({
  apiKeys: {
    id: "id",
    organizationId: "organizationId",
    userId: "userId",
    revokedAt: "revokedAt",
  },
}));

/**
 * ✅ Provide BOTH select + update.
 * ✅ Also mock "@/db/index" because some code imports that path.
 */
const dbMock = {
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: h.updateReturning,
        })),
      })),
    })),
  },
};

vi.mock("@/db", () => dbMock);
vi.mock("@/db/index", () => dbMock);

vi.mock("@/lib/api/secure-route", () => ({
  secureRoute: (handler: unknown) => {
    return async (req: NextRequest, props: { params: Promise<Record<string, string>> }) => {
      const params = await props.params;
      const ctx = (globalThis as { __ctx?: Record<string, unknown> }).__ctx ?? {
        userId: "u1",
        organizationId: 1,
        role: "admin",
        scopes: ["api_keys:write"],
        authType: "session",
      };

      return (handler as any)(req, ctx, params);
    };
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { DELETE } = await import("@/app/api/developer/api-keys/[id]/route");

describe("DELETE /api/developer/api-keys/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { __ctx?: Record<string, unknown> | undefined }).__ctx = undefined;
    selectQueue.length = 0;
  });

  it("sets revokedAt and returns 200", async () => {
    // ✅ route likely checks existence first
    selectQueue.push([{ id: 7, organizationId: 1, userId: "u1", revokedAt: null }]);

    // ✅ update returns a row after revocation
    h.updateReturning.mockResolvedValueOnce([{ id: 7, revokedAt: new Date().toISOString() }]);

    const req = new NextRequest("http://localhost/api/developer/api-keys/7", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "7" }) });

    if (res.status >= 400) {
      const body = await res.json().catch(() => null);
      throw new Error(`DELETE failed: status=${res.status} body=${JSON.stringify(body)}`);
    }

    expect(res.status).toBe(200);

    // Optional: if the route returns JSON
    const body = await res.json().catch(() => ({}));
    expect(body.success ?? true).toBeTruthy();

    // Sanity: select + update should have happened
    expect(dbMock.db.select).toHaveBeenCalled();
    expect(dbMock.db.update).toHaveBeenCalled();
  });

  it("returns 404 when key is not found", async () => {
    // ✅ existence check returns nothing
    selectQueue.push([]);

    const req = new NextRequest("http://localhost/api/developer/api-keys/999", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "999" }) });

    if (res.status >= 400 && res.status !== 404) {
      const body = await res.json().catch(() => null);
      throw new Error(`Expected 404, got ${res.status}. body=${JSON.stringify(body)}`);
    }

    expect(res.status).toBe(404);

    // Usually it should NOT attempt update if not found
    expect(dbMock.db.update).not.toHaveBeenCalled();
  });
});
