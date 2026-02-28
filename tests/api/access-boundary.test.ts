/**
 * Access boundary tests — Tenant A cannot access Tenant B's runs/exports.
 * Asserts 403 or 404 with normalized envelope when cross-tenant access is attempted.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getRun } from "@/app/api/evaluations/[id]/runs/[runId]/route";
import { GET as getRuns } from "@/app/api/evaluations/[id]/runs/route";
import { db } from "@/db";
import { evaluationRuns, evaluations, organizations } from "@/db/schema";

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

const { requireAuthWithOrg } = vi.hoisted(() => ({
	requireAuthWithOrg: vi.fn(),
}));

vi.mock("@/lib/autumn-server", () => ({
	requireAuthWithOrg,
}));

let ORG_A_ID: number;
let ORG_B_ID: number;
let EVAL_A_ID: number;
let RUN_A_ID: number;
let dbReady = false;

describe("Access boundary — cross-tenant isolation", () => {
	beforeAll(async () => {
		try {
			await db.select().from(organizations).limit(1);
			dbReady = true;
		} catch {
			dbReady = false;
			return;
		}
		if (!dbReady) return;

		const now = new Date();
		const [orgA] = await db
			.insert(organizations)
			.values({ name: "Tenant A", createdAt: now, updatedAt: now })
			.returning({ id: organizations.id });
		const [orgB] = await db
			.insert(organizations)
			.values({ name: "Tenant B", createdAt: now, updatedAt: now })
			.returning({ id: organizations.id });

		ORG_A_ID = orgA?.id;
		ORG_B_ID = orgB?.id;

		const [evalA] = await db
			.insert(evaluations)
			.values({
				name: "Eval A",
				description: "",
				type: "unit_test",
				status: "draft",
				organizationId: ORG_A_ID,
				createdBy: "test-user",
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: evaluations.id });
		EVAL_A_ID = evalA?.id;

		const [runA] = await db
			.insert(evaluationRuns)
			.values({
				evaluationId: EVAL_A_ID,
				organizationId: ORG_A_ID,
				status: "completed",
				createdAt: now,
			})
			.returning({ id: evaluationRuns.id });
		RUN_A_ID = runA?.id;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	async function assertNormalizedEnvelope(
		res: Response,
		expectedStatus: number,
	) {
		expect(res.status).toBe(expectedStatus);
		const data = await res.json();
		expect(data.error).toBeDefined();
		expect(data.error.code).toBeDefined();
		expect(data.error.message).toBeDefined();
		expect(data.error.requestId).toBeDefined();
		return data;
	}

	it("Tenant B cannot list Tenant A's runs (404)", async () => {
		if (!dbReady) return;

		requireAuthWithOrg.mockResolvedValue({
			authenticated: true,
			userId: "tenant-b-user",
			organizationId: ORG_B_ID,
			role: "member",
			scopes: ["runs:read"],
			authType: "apiKey",
		});

		const req = new NextRequest(
			`http://localhost/api/evaluations/${EVAL_A_ID}/runs`,
		);
		const res = await getRuns(req, {
			params: Promise.resolve({ id: String(EVAL_A_ID) }),
		});

		const data = await assertNormalizedEnvelope(res, 404);
		expect(data.error.code).toBe("NOT_FOUND");
	});

	it("Tenant B cannot get Tenant A's run by ID (404)", async () => {
		if (!dbReady) return;

		requireAuthWithOrg.mockResolvedValue({
			authenticated: true,
			userId: "tenant-b-user",
			organizationId: ORG_B_ID,
			role: "member",
			scopes: ["runs:read"],
			authType: "apiKey",
		});

		const req = new NextRequest(
			`http://localhost/api/evaluations/${EVAL_A_ID}/runs/${RUN_A_ID}`,
		);
		const res = await getRun(req, {
			params: Promise.resolve({
				id: String(EVAL_A_ID),
				runId: String(RUN_A_ID),
			}),
		});

		const data = await assertNormalizedEnvelope(res, 404);
		expect(data.error.code).toBe("NOT_FOUND");
	});

	it("Tenant B with guessed eval ID gets 404 (no info leak)", async () => {
		if (!dbReady) return;

		requireAuthWithOrg.mockResolvedValue({
			authenticated: true,
			userId: "tenant-b-user",
			organizationId: ORG_B_ID,
			role: "member",
			scopes: ["runs:read"],
			authType: "apiKey",
		});

		const guessedEvalId = 999999;
		const req = new NextRequest(
			`http://localhost/api/evaluations/${guessedEvalId}/runs`,
		);
		const res = await getRuns(req, {
			params: Promise.resolve({ id: String(guessedEvalId) }),
		});

		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error?.code).toBe("NOT_FOUND");
	});

	it("Tenant A can access own runs (200)", async () => {
		if (!dbReady) return;

		requireAuthWithOrg.mockResolvedValue({
			authenticated: true,
			userId: "tenant-a-user",
			organizationId: ORG_A_ID,
			role: "member",
			scopes: ["runs:read"],
			authType: "apiKey",
		});

		const req = new NextRequest(
			`http://localhost/api/evaluations/${EVAL_A_ID}/runs`,
		);
		const res = await getRuns(req, {
			params: Promise.resolve({ id: String(EVAL_A_ID) }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(Array.isArray(data)).toBe(true);
	});
});
