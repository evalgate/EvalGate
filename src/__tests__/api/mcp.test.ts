/**
 * MCP API tests
 * /api/mcp/tools (anonymous) and /api/mcp/call (auth required)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postCall } from "@/app/api/mcp/call/route";
import { GET as getTools } from "@/app/api/mcp/tools/route";

const routeContext = { params: Promise.resolve({}) };

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn((_req: unknown, handler: (r: unknown) => Promise<Response>) =>
    handler(_req),
  ),
}));

const mockRequireAuthWithOrg = vi.hoisted(() => vi.fn());
vi.mock("@/lib/autumn-server", () => ({
  requireAuthWithOrg: (...args: unknown[]) => mockRequireAuthWithOrg(...args),
}));

vi.mock("@/lib/services/evaluation.service", () => ({
  evaluationService: {
    getById: vi.fn(),
    list: vi.fn(),
  },
}));

import { evaluationService as mockEvaluationService } from "@/lib/services/evaluation.service";

describe("/api/mcp/tools", () => {
  it("returns tool list without auth (anonymous)", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/tools");
    const response = await getTools(req, routeContext as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("tools");
    expect(data).toHaveProperty("mcpVersion", "1");
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThan(0);
    expect(data.tools[0]).toHaveProperty("name");
    expect(data.tools[0]).toHaveProperty("description");
    expect(data.tools[0]).toHaveProperty("inputSchema");
  });

  it("returns version and longRunning for tools", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/tools");
    const response = await getTools(req, routeContext as never);
    const data = await response.json();
    const evalRun = data.tools.find((t: { name: string }) => t.name === "eval.run");
    expect(evalRun).toBeDefined();
    expect(evalRun.version).toBe("1");
    expect(evalRun.longRunning).toBe(true);
  });

  it("returns cache headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/tools");
    const response = await getTools(req, routeContext as never);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, stale-while-revalidate=86400",
    );
  });
});

const authedCtx = {
  authenticated: true,
  userId: "test-user",
  organizationId: 1,
  role: "member" as const,
  scopes: ["eval:read", "eval:write", "runs:read", "runs:write", "traces:read", "traces:write"],
  authType: "session" as const,
};

describe("/api/mcp/call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthWithOrg.mockResolvedValue(authedCtx);
    vi.mocked(mockEvaluationService.getById).mockResolvedValue(null);
    vi.mocked(mockEvaluationService.list).mockResolvedValue([]);
  });

  it("rejects invalid body", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: "not json",
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unknown tool", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({ tool: "unknown.tool", arguments: {} }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects evaluationId as string (NaN never reaches service)", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: "abc" },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(mockEvaluationService.getById).not.toHaveBeenCalled();
  });

  it("rejects missing required args", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: {},
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects wrong types (evaluationId as object)", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: {} },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when evaluation not found", async () => {
    vi.mocked(mockEvaluationService.getById).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: 999 },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error?.code).toBe("NOT_FOUND");
    expect(data.error?.message).toContain("not found");
  });

  it("returns 500 for unexpected throws", async () => {
    vi.mocked(mockEvaluationService.getById).mockRejectedValue(new Error("DB connection lost"));

    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: 1 },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error?.code).toBe("INTERNAL");
    expect(data.error?.message).toBe("Tool execution failed");
    expect(data.error?.requestId).toBeDefined();
  });

  it("success response includes type json content", async () => {
    vi.mocked(mockEvaluationService.getById).mockResolvedValue({
      id: 1,
      name: "Test Eval",
      organizationId: 1,
      status: "active",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: 1 },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.content).toBeDefined();
    expect(Array.isArray(data.content)).toBe(true);
    const jsonBlock = data.content.find((c: { type: string }) => c.type === "json");
    expect(jsonBlock).toBeDefined();
    expect(jsonBlock.json).toEqual(
      expect.objectContaining({ id: 1, name: "Test Eval", organizationId: 1 }),
    );
  });

  it("returns 403 when scope insufficient", async () => {
    mockRequireAuthWithOrg.mockResolvedValueOnce({
      ...authedCtx,
      scopes: [], // no scopes
    });

    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "eval.get",
        arguments: { evaluationId: 1 },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });

  it("rejects oversized metadata", async () => {
    const hugeMetadata: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      hugeMetadata[`key${i}`] = "x".repeat(100);
    }

    const req = new NextRequest("http://localhost:3000/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        tool: "trace.create",
        arguments: {
          name: "test",
          traceId: "t1",
          metadata: hugeMetadata,
        },
      }),
    });

    const response = await postCall(req, routeContext as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });
});
