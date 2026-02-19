/**
 * Exports API contract test
 * Verifies GET /api/exports/[shareId] returns ShareExportDTO that passes validateDemoData,
 * and correct status codes for 404 (not found), 410 (expired/revoked).
 */

import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn(async (_req: Request, handler: (req: Request) => Promise<Response>) =>
    handler(_req),
  ),
}));

vi.mock("@/lib/api/request-id", () => ({
  extractOrGenerateRequestId: () => "test-request-id",
  runWithRequestIdAsync: (_id: string, fn: () => Promise<Response>) => fn(),
  getRequestId: () => "test-request-id",
  setRequestContext: () => {},
  getRequestContext: () => ({}),
}));

import { eq, inArray, sql } from "drizzle-orm";
import { GET } from "@/app/api/exports/[shareId]/route";
import { db } from "@/db";
import { evaluations, organizations, sharedExports } from "@/db/schema";
import { validateDemoData } from "@/lib/demo-loader";

let ORG_ID: number;
let EVAL_ID: number;

const validExportData = {
  evaluation: {
    id: "test-eval-1",
    name: "Test Evaluation",
    description: "A test evaluation",
    type: "unit_test",
    category: "test",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  timestamp: "2024-01-15T12:00:00.000Z",
  summary: { totalTests: 10, passed: 8, failed: 2, passRate: "80%" },
  qualityScore: {
    overall: 80,
    grade: "B",
    metrics: { accuracy: 85, safety: 90, latency: 75, cost: 80, consistency: 85 },
    insights: ["Good performance"],
    recommendations: ["Improve latency"],
  },
  type: "unit_test",
  published_at: "2024-01-15T12:00:00.000Z",
  share_id: "contract-test-share",
  public: true,
};

function computeHash(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

describe("GET /api/exports/[shareId] contract", () => {
  let dbReady = false;

  beforeAll(async () => {
    try {
      await db.select().from(sharedExports).limit(1);
      dbReady = true;
    } catch {
      dbReady = false;
    }
    // Ensure org and evaluation exist for FK constraints
    let orgs = await db.select().from(organizations).limit(1);
    if (orgs.length === 0) {
      const now = new Date().toISOString();
      await db.insert(organizations).values({
        name: "Test Org",
        createdAt: now,
        updatedAt: now,
      });
      orgs = await db.select().from(organizations).limit(1);
    }
    ORG_ID = orgs[0]!.id;

    let evals = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.organizationId, ORG_ID))
      .limit(1);
    if (evals.length === 0) {
      const now = new Date().toISOString();
      await db.run(
        sql`INSERT INTO evaluations (name, description, type, status, organization_id, created_by, created_at, updated_at) VALUES ('Test Eval', 'Test', 'unit_test', 'draft', ${ORG_ID}, 'test-user', ${now}, ${now})`,
      );
      evals = await db
        .select({ id: evaluations.id })
        .from(evaluations)
        .where(eq(evaluations.organizationId, ORG_ID))
        .limit(1);
    }
    EVAL_ID = evals[0]!.id;
  });

  afterEach(async () => {
    if (!dbReady) return;
    await db
      .delete(sharedExports)
      .where(
        inArray(sharedExports.shareId, ["contract-test-share", "revoked-share", "expired-share"]),
      );
  });

  it("returns 304 when If-None-Match matches ETag (exportHash)", async () => {
    if (!dbReady) return;

    const shareId = "contract-test-share";
    const exportHash = computeHash(validExportData);

    await db.insert(sharedExports).values({
      shareId,
      organizationId: ORG_ID,
      evaluationId: EVAL_ID,
      evaluationRunId: null,
      shareScope: "evaluation",
      exportData: validExportData,
      exportHash,
      isPublic: true,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });

    const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`, {
      headers: { "If-None-Match": `"${exportHash}"` },
    });
    const res = await GET(req, { params: Promise.resolve({ shareId }) });

    expect(res.status).toBe(304);
    const text = await res.text();
    expect(text).toBe("");
    expect(res.headers.get("ETag")).toBe(`"${exportHash}"`);
  });

  it("returns 404 for unknown shareId", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports/nonexistent-id");
    const res = await GET(req, { params: Promise.resolve({ shareId: "nonexistent-id" }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error?.code).toBe("NOT_FOUND");
  });

  it("returns 200 and ShareExportDTO that passes validateDemoData when share exists", async () => {
    if (!dbReady) return;

    const shareId = "contract-test-share";
    const exportHash = computeHash(validExportData);

    await db.insert(sharedExports).values({
      shareId,
      organizationId: ORG_ID,
      evaluationId: EVAL_ID,
      evaluationRunId: null,
      shareScope: "evaluation",
      exportData: validExportData,
      exportHash,
      isPublic: true,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });

    const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
    const res = await GET(req, { params: Promise.resolve({ shareId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(validateDemoData(data)).toBe(true);
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Test Evaluation");
    expect(data.type).toBe("unit_test");
    expect(data.summary).toEqual(validExportData.summary);
    expect(data.qualityScore).toBeDefined();
    expect(data.exportHash).toBe(exportHash);
    expect(data.shareScope).toBe("evaluation");
    expect(data.privacyScrubbed).toBe(true);
    expect(data.sourceRunId).toBeUndefined();
  });

  it("returns 410 when share is revoked", async () => {
    if (!dbReady) return;

    const shareId = "revoked-share";
    const exportHash = computeHash(validExportData);

    await db.insert(sharedExports).values({
      shareId,
      organizationId: ORG_ID,
      evaluationId: EVAL_ID,
      evaluationRunId: null,
      shareScope: "evaluation",
      exportData: validExportData,
      exportHash,
      isPublic: true,
      revokedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });

    const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
    const res = await GET(req, { params: Promise.resolve({ shareId }) });

    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error?.code).toBe("SHARE_REVOKED");
  });

  it("returns 410 when share is expired", async () => {
    if (!dbReady) return;

    const shareId = "expired-share";
    const exportHash = computeHash(validExportData);
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

    await db.insert(sharedExports).values({
      shareId,
      organizationId: ORG_ID,
      evaluationId: EVAL_ID,
      evaluationRunId: null,
      shareScope: "evaluation",
      exportData: validExportData,
      exportHash,
      isPublic: true,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      expiresAt: pastDate,
    });

    const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
    const res = await GET(req, { params: Promise.resolve({ shareId }) });

    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error?.code).toBe("SHARE_EXPIRED");
  });
});
