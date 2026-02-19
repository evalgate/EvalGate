import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/quality/route";
import { GET as GET_SPEC } from "@/app/api/quality/spec/route";

const routeContext = { params: Promise.resolve({}) };

vi.mock("@/lib/services/quality.service", () => ({
  qualityService: {
    latest: vi.fn().mockResolvedValue({
      id: 1,
      evaluationRunId: 1,
      evaluationId: 1,
      organizationId: 1,
      score: 85,
      total: 10,
      breakdown: {},
      flags: [],
      evidenceLevel: "strong",
      scoringVersion: "v1",
      createdAt: new Date().toISOString(),
    }),
    trend: vi.fn().mockResolvedValue({
      data: [],
      count: 0,
    }),
  },
}));

vi.mock("@/lib/services/aggregate-metrics.service", () => ({
  recomputeAndStoreQualityScore: vi.fn(),
  computeAndStoreQualityScore: vi.fn(),
  computeRunAggregates: vi.fn().mockResolvedValue({
    avgLatencyMs: 150,
    runTotalCostUsd: 0.05,
  }),
}));

vi.mock("@/lib/autumn-server", () => ({
  requireAuthWithOrg: vi.fn().mockResolvedValue({
    authenticated: true,
    userId: "test-user",
    organizationId: 1,
    role: "member",
    scopes: ["runs:read", "runs:write"],
    authType: "session",
  }),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn((_req: unknown, handler: (r: unknown) => Promise<Response>) =>
    handler(_req),
  ),
}));

describe("/api/quality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return latest quality score with evaluationId", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality?evaluationId=1&action=latest");

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(200);
    });

    it("should return trend with evaluationId", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality?evaluationId=1&action=trend");

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(200);
    });

    it("should return 400 when evaluationId is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality?action=latest");

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(400);
    });

    it("should return 400 when action is invalid", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/quality?evaluationId=1&action=invalid",
      );

      const response = await GET(req, routeContext as never);

      expect(response.status).toBe(400);
    });
  });

  describe("POST (recompute)", () => {
    it("should recompute and return score when run exists", async () => {
      const { recomputeAndStoreQualityScore } = await import(
        "@/lib/services/aggregate-metrics.service"
      );
      vi.mocked(recomputeAndStoreQualityScore).mockResolvedValue({
        score: 92,
        breakdown: { passRate: 0.9, safety: 1, judge: 0.95, schema: 1, latency: 1, cost: 1 },
        flags: [],
        evidenceLevel: "strong",
      });

      const req = new NextRequest("http://localhost:3000/api/quality", {
        method: "POST",
        body: JSON.stringify({ runId: 1 }),
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.runId).toBe(1);
      expect(data.score).toBe(92);
      expect(data.evidenceLevel).toBe("strong");
      expect(data.scoringVersion).toBe("v1");
      expect(typeof data.scoringSpecHash).toBe("string");
      expect(data.scoringSpecHash.length).toBeGreaterThan(0);
    });

    it("should return 404 when run not found", async () => {
      const { recomputeAndStoreQualityScore } = await import(
        "@/lib/services/aggregate-metrics.service"
      );
      vi.mocked(recomputeAndStoreQualityScore).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/quality", {
        method: "POST",
        body: JSON.stringify({ runId: 999 }),
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(404);
    });

    it("should return 400 when runId is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(400);
    });

    it("should return 400 when body is invalid JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality", {
        method: "POST",
        body: "not json",
      });

      const response = await POST(req, routeContext as never);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/quality/spec", () => {
    it("should return scoring spec for audit", async () => {
      const req = new NextRequest("http://localhost:3000/api/quality/spec");

      const response = await GET_SPEC(req, routeContext as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.version).toBe("v1");
      expect(data.spec).toBeDefined();
      expect(data.spec.version).toBe("v1");
      expect(data.spec.weights).toBeDefined();
      expect(data.specHash).toBeDefined();
      expect(typeof data.specHash).toBe("string");
    });
  });
});
