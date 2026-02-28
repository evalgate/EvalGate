/**
 * Exports API contract test
 * Verifies GET /api/exports/[shareId] returns ShareExportDTO that passes validateDemoData,
 * and correct status codes for 404 (not found), 410 (expired/revoked/unavailable).
 */

import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-rate-limit", () => ({
	withRateLimit: vi.fn(
		async (_req: Request, handler: (req: Request) => Promise<Response>) =>
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

import { eq, inArray } from "drizzle-orm";
import { GET } from "@/app/api/exports/[shareId]/route";
import { db } from "@/db";
import { evaluations, organizations, sharedExports } from "@/db/schema";
import { validateDemoData } from "@/lib/demo-loader";
import { computeExportHash } from "@/lib/shared-exports";

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
		metrics: {
			accuracy: 85,
			safety: 90,
			latency: 75,
			cost: 80,
			consistency: 85,
		},
		insights: ["Good performance"],
		recommendations: ["Improve latency"],
	},
	type: "unit_test",
	published_at: "2024-01-15T12:00:00.000Z",
	share_id: "contract-test-share",
	public: true,
};

describe("GET /api/exports/[shareId] contract", () => {
	let dbReady = false;

	beforeAll(async () => {
		try {
			await db.select().from(sharedExports).limit(1);
			dbReady = true;
		} catch {
			dbReady = false;
		}
		if (!dbReady) return;
		// Ensure org and evaluation exist for FK constraints
		let orgs = await db.select().from(organizations).limit(1);
		if (orgs.length === 0) {
			const now = new Date();
			await db.insert(organizations).values({
				name: "Test Org",
				createdAt: now,
				updatedAt: now,
			});
			orgs = await db.select().from(organizations).limit(1);
		}
		ORG_ID = orgs[0]?.id;

		let evals = await db
			.select({ id: evaluations.id })
			.from(evaluations)
			.where(eq(evaluations.organizationId, ORG_ID))
			.limit(1);
		if (evals.length === 0) {
			const now = new Date();
			await db.insert(evaluations).values({
				name: "Test Eval",
				description: "Test",
				type: "unit_test",
				status: "draft",
				organizationId: ORG_ID,
				createdBy: "test-user",
				createdAt: now,
				updatedAt: now,
			});
			evals = await db
				.select({ id: evaluations.id })
				.from(evaluations)
				.where(eq(evaluations.organizationId, ORG_ID))
				.limit(1);
		}
		EVAL_ID = evals[0]?.id;
	});

	afterEach(async () => {
		if (!dbReady) return;
		await db
			.delete(sharedExports)
			.where(
				inArray(sharedExports.shareId, [
					"contract-test-share",
					"revoked-share",
					"expired-share",
					"unavailable-share",
					"view-count-test",
					"etag-invariant-share",
					"expires-at-visibility-share",
				]),
			);
	});

	it("viewCount increments correctly under parallel GETs (no lost updates)", async () => {
		if (!dbReady) return;

		const shareId = "view-count-test";
		const exportHash = computeExportHash(validExportData);

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
			viewCount: 0,
			createdAt: new Date(),
			expiresAt: null,
		});

		const concurrency = 10;
		const requests = Array.from({ length: concurrency }, () =>
			GET(new NextRequest(`http://localhost:3000/api/exports/${shareId}`), {
				params: Promise.resolve({ shareId }),
			}),
		);
		const responses = await Promise.all(requests);

		expect(responses.every((r) => r.status === 200)).toBe(true);

		const [row] = await db
			.select({ viewCount: sharedExports.viewCount })
			.from(sharedExports)
			.where(eq(sharedExports.shareId, shareId));
		expect(row).toBeDefined();
		expect(row?.viewCount).toBe(concurrency);
	});

	it("returns 304 when If-None-Match matches ETag (exportHash)", async () => {
		if (!dbReady) return;

		const shareId = "contract-test-share";
		const exportHash = computeExportHash(validExportData);

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
			createdAt: new Date(),
			expiresAt: null,
		});

		const req = new NextRequest(
			`http://localhost:3000/api/exports/${shareId}`,
			{
				headers: { "If-None-Match": `"${exportHash}"` },
			},
		);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(304);
		const text = await res.text();
		expect(text).toBe("");
		expect(res.headers.get("ETag")).toBe(`"${exportHash}"`);
		expect(res.headers.get("Cache-Control")).toMatch(/public,\s*max-age=\d+/);
	});

	it("two GETs for unchanged export return identical ETag", async () => {
		if (!dbReady) return;

		const shareId = "etag-invariant-share";
		const exportHash = computeExportHash(validExportData);

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
			createdAt: new Date(),
			expiresAt: null,
		});

		const req1 = new NextRequest(
			`http://localhost:3000/api/exports/${shareId}`,
		);
		const req2 = new NextRequest(
			`http://localhost:3000/api/exports/${shareId}`,
		);
		const [res1, res2] = await Promise.all([
			GET(req1, { params: Promise.resolve({ shareId }) }),
			GET(req2, { params: Promise.resolve({ shareId }) }),
		]);

		expect(res1.status).toBe(200);
		expect(res2.status).toBe(200);
		const etag1 = res1.headers.get("ETag");
		const etag2 = res2.headers.get("ETag");
		expect(etag1).toBe(etag2);
		expect(etag1).toBe(`"${exportHash}"`);
	});

	it("after export update (hash changes), ETag changes", async () => {
		if (!dbReady) return;

		const shareId = "etag-invariant-share";
		const exportHash1 = computeExportHash(validExportData);
		const updatedData = {
			...validExportData,
			summary: { totalTests: 12, passed: 10, failed: 2, passRate: "83%" },
		};
		const exportHash2 = computeExportHash(updatedData);

		await db.insert(sharedExports).values({
			shareId,
			organizationId: ORG_ID,
			evaluationId: EVAL_ID,
			evaluationRunId: null,
			shareScope: "evaluation",
			exportData: validExportData,
			exportHash: exportHash1,
			isPublic: true,
			revokedAt: null,
			createdAt: new Date(),
			expiresAt: null,
		});

		const res1 = await GET(
			new NextRequest(`http://localhost:3000/api/exports/${shareId}`),
			{
				params: Promise.resolve({ shareId }),
			},
		);
		expect(res1.status).toBe(200);
		expect(res1.headers.get("ETag")).toBe(`"${exportHash1}"`);

		await db
			.update(sharedExports)
			.set({ exportData: updatedData, exportHash: exportHash2 })
			.where(eq(sharedExports.shareId, shareId));

		const res2 = await GET(
			new NextRequest(`http://localhost:3000/api/exports/${shareId}`),
			{
				params: Promise.resolve({ shareId }),
			},
		);
		expect(res2.status).toBe(200);
		expect(res2.headers.get("ETag")).toBe(`"${exportHash2}"`);
		expect(res2.headers.get("ETag")).not.toBe(res1.headers.get("ETag"));
	});

	it("returns 404 for unknown shareId with error envelope", async () => {
		if (!dbReady) return;
		const req = new NextRequest(
			"http://localhost:3000/api/exports/nonexistent-id",
		);
		const res = await GET(req, {
			params: Promise.resolve({ shareId: "nonexistent-id" }),
		});
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error?.code).toBe("NOT_FOUND");
		expect(data.error?.message).toBe("Share not found");
		expect(data.error?.requestId).toBeDefined();
	});

	it("returns 200 with ETag and Cache-Control headers when share exists", async () => {
		if (!dbReady) return;

		const shareId = "contract-test-share";
		const exportHash = computeExportHash(validExportData);

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
			createdAt: new Date(),
			expiresAt: null,
		});

		const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(200);
		expect(res.headers.get("ETag")).toBe(`"${exportHash}"`);
		expect(res.headers.get("Cache-Control")).toMatch(/public,\s*max-age=\d+/);
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

	it("includes expiresAt in response when set (retention visibility)", async () => {
		if (!dbReady) return;

		const shareId = "expires-at-visibility-share";
		const exportHash = computeExportHash(validExportData);
		const futureExpiry = new Date(Date.now() + 86400000 * 7); // 7 days

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
			createdAt: new Date(),
			expiresAt: futureExpiry,
		});

		const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.expiresAt).toBe(futureExpiry.toISOString());

		await db.delete(sharedExports).where(eq(sharedExports.shareId, shareId));
	});

	it("returns 410 when share is revoked", async () => {
		if (!dbReady) return;

		const shareId = "revoked-share";
		const exportHash = computeExportHash(validExportData);

		await db.insert(sharedExports).values({
			shareId,
			organizationId: ORG_ID,
			evaluationId: EVAL_ID,
			evaluationRunId: null,
			shareScope: "evaluation",
			exportData: validExportData,
			exportHash,
			isPublic: true,
			revokedAt: new Date(),
			createdAt: new Date(),
			expiresAt: null,
		});

		const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(410);
		const data = await res.json();
		expect(data.error?.code).toBe("SHARE_REVOKED");
		expect(data.error?.message).toBeDefined();
		expect(data.error?.requestId).toBeDefined();
	});

	it("returns 410 when share is unavailable (isPublic false)", async () => {
		if (!dbReady) return;

		const shareId = "unavailable-share";
		const exportHash = computeExportHash(validExportData);

		await db.insert(sharedExports).values({
			shareId,
			organizationId: ORG_ID,
			evaluationId: EVAL_ID,
			evaluationRunId: null,
			shareScope: "evaluation",
			exportData: validExportData,
			exportHash,
			isPublic: false,
			revokedAt: null,
			createdAt: new Date(),
			expiresAt: null,
		});

		const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(410);
		const data = await res.json();
		expect(data.error?.code).toBe("SHARE_UNAVAILABLE");
		expect(data.error?.message).toBe("This share link is no longer available");
	});

	it("returns 410 when share is expired", async () => {
		if (!dbReady) return;

		const shareId = "expired-share";
		const exportHash = computeExportHash(validExportData);
		const pastDate = new Date(Date.now() - 86400000); // 1 day ago

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
			createdAt: new Date(),
			expiresAt: pastDate,
		});

		const req = new NextRequest(`http://localhost:3000/api/exports/${shareId}`);
		const res = await GET(req, { params: Promise.resolve({ shareId }) });

		expect(res.status).toBe(410);
		const data = await res.json();
		expect(data.error?.code).toBe("SHARE_EXPIRED");
		expect(data.error?.message).toBe("This share link has expired");
		expect(data.error?.requestId).toBeDefined();
	});
});
