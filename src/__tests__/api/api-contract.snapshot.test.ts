/**
 * API Contract Snapshot Tests
 * Locks response shapes for /api/quality, /api/reports, /api/mcp/call.
 * Run: pnpm test src/__tests__/api/api-contract.snapshot.test.ts
 * Update snapshots: pnpm test src/__tests__/api/api-contract.snapshot.test.ts -u
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as mcpCall } from "@/app/api/mcp/call/route";
import { GET as qualityGet } from "@/app/api/quality/route";
import { GET as reportsGet } from "@/app/api/reports/route";

const routeContext = { params: Promise.resolve({}) };

const FIXED_REQUEST_ID = "00000000-0000-0000-0000-000000000001";

const createDbChain = <T>(result: T) => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => Promise.resolve(result),
    values: () => Promise.resolve(undefined),
  };
  return chain;
};

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn((_req: unknown, handler: (r: unknown) => Promise<Response>) =>
    handler(_req),
  ),
}));

vi.mock("@/lib/api/request-id", () => ({
  extractOrGenerateRequestId: () => FIXED_REQUEST_ID,
  runWithRequestIdAsync: (_id: string, fn: () => Promise<Response>) => fn(),
  getRequestId: () => FIXED_REQUEST_ID,
  setRequestContext: () => {},
  getRequestContext: () => ({}),
}));

vi.mock("@/lib/autumn-server", () => ({
  requireAuthWithOrg: vi.fn().mockResolvedValue({
    authenticated: true,
    userId: "snapshot-user",
    organizationId: 1,
    role: "member",
    scopes: ["runs:read", "runs:write", "reports:write", "runs:read", "eval:read", "eval:write"],
    authType: "session",
  }),
}));

vi.mock("@/lib/services/quality.service", () => ({
  qualityService: {
    latest: vi.fn().mockResolvedValue({
      id: 1,
      evaluationRunId: 1,
      evaluationId: 1,
      organizationId: 1,
      score: 85,
      total: 10,
      traceCoverageRate: "1.0",
      provenanceCoverageRate: "0.9",
      breakdown: { passRate: 0.9, safety: 1 },
      flags: [],
      evidenceLevel: "strong",
      scoringVersion: "v1",
      model: null,
      createdAt: "2024-01-15T12:00:00.000Z",
      baselineScore: 80,
      regressionDelta: 5,
      regressionDetected: false,
    }),
    trend: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: {
    select: () => createDbChain([]),
    insert: () => ({ values: () => Promise.resolve(undefined) }),
  },
}));

const mockExecuteMcpTool = vi.fn();
vi.mock("@/lib/mcp/registry", () => ({
  MCP_TOOLS: [
    {
      name: "eval.get",
      description: "Get evaluation",
      inputSchema: { type: "object", properties: { evaluationId: { type: "number" } } },
      version: "1",
      requiredScopes: ["eval:read"],
    },
  ],
  executeMcpTool: (...args: unknown[]) => mockExecuteMcpTool(...args),
}));

vi.mock("@/lib/mcp/usage", () => ({
  trackMcpToolExecution: vi.fn(),
}));

vi.mock("@/lib/mcp/schemas", () => ({
  McpCallBodySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  ToolArgs: {
    "eval.get": { safeParse: (d: unknown) => ({ success: true, data: d }) },
  },
}));

describe("API contract snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/quality?action=latest", () => {
    it("matches snapshot for latest quality score", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality?evaluationId=1&action=latest");
      const response = await qualityGet(req, routeContext as never);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchSnapshot();
    });
  });

  describe("GET /api/reports", () => {
    it("matches snapshot for reports list response", async () => {
      const req = new NextRequest("http://localhost:3000/api/reports");
      const response = await reportsGet(req, routeContext as never);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchSnapshot();
    });
  });

  describe("POST /api/mcp/call", () => {
    it("matches snapshot for successful tool execution", async () => {
      mockExecuteMcpTool.mockResolvedValue({
        id: 1,
        name: "Test Eval",
        type: "unit_test",
        status: "active",
      });

      const req = new NextRequest("http://localhost:3000/api/mcp/call", {
        method: "POST",
        body: JSON.stringify({ tool: "eval.get", arguments: { evaluationId: 1 } }),
      });
      const response = await mcpCall(req, routeContext as never);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchSnapshot();
    });

    it("matches snapshot for error response", async () => {
      const { McpToolError } = await import("@/lib/mcp/errors");
      mockExecuteMcpTool.mockRejectedValue(
        new McpToolError("NOT_FOUND", "Evaluation not found", 404),
      );

      const req = new NextRequest("http://localhost:3000/api/mcp/call", {
        method: "POST",
        body: JSON.stringify({ tool: "eval.get", arguments: { evaluationId: 999 } }),
      });
      const response = await mcpCall(req, routeContext as never);
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body).toMatchSnapshot();
    });
  });
});
