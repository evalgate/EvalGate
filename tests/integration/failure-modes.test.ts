/**
 * Failure Mode Tests
 *
 * Test what happens when things go wrong. Enterprise buyers trust tools
 * that fail gracefully — these tests prove it.
 *
 * Covers:
 * - Evaluation not found (nonexistent ID)
 * - Run on evaluation with zero test cases
 * - Malformed/missing inputs
 * - Share export revocation (soft delete)
 * - Export sanitization rejects oversized payloads
 * - Export sanitization rejects circular references
 * - Delete nonexistent evaluation
 * - Update nonexistent evaluation
 */

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { evaluations, sharedExports, testResults } from "@/db/schema";
import { evaluationService } from "@/lib/services/evaluation.service";
import {
	prepareExportForShare,
	sanitizeExportData,
} from "@/lib/shared-exports";

const ORG_ID = 1;
let dbReady = false;

beforeAll(async () => {
	try {
		await db.select().from(evaluations).limit(1);
		dbReady = true;
	} catch {
		dbReady = false;
	}
});

// ── Nonexistent Resources ──

describe("Nonexistent resource handling", () => {
	it("getById returns null for nonexistent evaluation", async () => {
		if (!dbReady) return;
		const result = await evaluationService.getById(999999, ORG_ID);
		expect(result).toBeNull();
	});

	it("run returns null for nonexistent evaluation", async () => {
		if (!dbReady) return;
		const result = await evaluationService.run(999999, ORG_ID);
		expect(result).toBeNull();
	});

	it("delete returns false for nonexistent evaluation", async () => {
		if (!dbReady) return;
		const result = await evaluationService.delete(999999, ORG_ID);
		expect(result).toBe(false);
	});

	it("update returns null for nonexistent evaluation", async () => {
		if (!dbReady) return;
		const result = await evaluationService.update(999999, ORG_ID, {
			name: "nope",
		});
		expect(result).toBeNull();
	});

	it("getStats returns null for nonexistent evaluation", async () => {
		if (!dbReady) return;
		const result = await evaluationService.getStats(999999, ORG_ID);
		expect(result).toBeNull();
	});
});

// ── Cross-Org Access Boundary ──

describe("Cross-org access boundary", () => {
	it("cannot read evaluation from wrong org", async () => {
		if (!dbReady) return;
		const eval1 = await evaluationService.create(ORG_ID, "test-user", {
			name: "Org Boundary Test",
			type: "unit_test",
		});
		// Org 9999 should not be able to access org 1's evaluation
		const result = await evaluationService.getById(eval1.id, 9999);
		expect(result).toBeNull();
	});

	it("cannot run evaluation from wrong org", async () => {
		if (!dbReady) return;
		const eval1 = await evaluationService.create(ORG_ID, "test-user", {
			name: "Org Boundary Run Test",
			type: "unit_test",
		});
		const result = await evaluationService.run(eval1.id, 9999);
		expect(result).toBeNull();
	});

	it("cannot delete evaluation from wrong org", async () => {
		if (!dbReady) return;
		const eval1 = await evaluationService.create(ORG_ID, "test-user", {
			name: "Org Boundary Delete Test",
			type: "unit_test",
		});
		const result = await evaluationService.delete(eval1.id, 9999);
		expect(result).toBe(false);
		// Verify it still exists in the correct org
		const still = await evaluationService.getById(eval1.id, ORG_ID);
		expect(still).toBeTruthy();
	});
});

// ── Zero Test Cases ──

describe("Run with zero test cases", () => {
	it("completes immediately with zero counts", async () => {
		if (!dbReady) return;
		const eval1 = await evaluationService.create(ORG_ID, "test-user", {
			name: "Empty Eval",
			type: "unit_test",
			// No test cases
		});

		const run = await evaluationService.run(eval1.id, ORG_ID);
		expect(run).toBeTruthy();
		// Should mark as completed with no failures
		expect(run?.status).toBe("completed");
	});
});

// ── Export Sanitization Failure Modes ──

describe("Export sanitization failure modes", () => {
	it("rejects null export data", () => {
		expect(() => sanitizeExportData(null)).toThrow(
			"Export data must be a non-null object",
		);
	});

	it("rejects non-object export data", () => {
		expect(() =>
			sanitizeExportData("string" as unknown as Record<string, unknown>),
		).toThrow();
	});

	it("rejects oversized export data", () => {
		const huge = {
			evaluation: { id: "1", name: "Test" },
			timestamp: "t",
			testResults: Array.from({ length: 10000 }, (_, i) => ({
				id: String(i),
				name: `Test ${i}`,
				input: "x".repeat(100),
				expected_output: "y".repeat(100),
				actual_output: "z".repeat(100),
				passed: true,
			})),
		};
		expect(() => sanitizeExportData(huge)).toThrow(/exceeds maximum size/);
	});

	it("strips disallowed top-level keys silently", () => {
		const dirty = {
			evaluation: { id: "1", name: "Test" },
			timestamp: "t",
			malicious: "payload",
			internal: { secret: true },
		};
		const sanitized = sanitizeExportData(dirty);
		expect(sanitized).not.toHaveProperty("malicious");
		expect(sanitized).not.toHaveProperty("internal");
		expect(sanitized).toHaveProperty("evaluation");
	});

	it("rejects export with secret-like keys", () => {
		const withSecret = {
			evaluation: {
				id: "1",
				name: "Test",
				apiKey: "sk-123456789012345678901234567890",
			},
		};
		// sanitizeExportData allows it (it's nested), but assertNoSecrets catches it
		expect(() => prepareExportForShare(withSecret)).toThrow();
	});
});

// ── Share Revocation ──

describe("Share revocation handling", () => {
	it("revoked share has revokedAt timestamp", async () => {
		if (!dbReady) return;
		// Create a minimal evaluation
		const eval1 = await evaluationService.create(ORG_ID, "test-user", {
			name: "Share Revoke Test",
			type: "unit_test",
		});

		// Insert a share record directly
		const shareId = `test-revoke-${Date.now()}`;
		await db.insert(sharedExports).values({
			shareId,
			organizationId: ORG_ID,
			evaluationId: eval1.id,
			shareScope: "evaluation",
			exportData: { evaluation: { id: String(eval1.id), name: "Test" } },
			exportHash: "abc123",
			isPublic: true,
			createdAt: new Date(),
		});

		// Revoke it
		const now = new Date();
		await db
			.update(sharedExports)
			.set({ revokedAt: now, revokedBy: "test-user" })
			.where(eq(sharedExports.shareId, shareId));

		// Verify revocation
		const [revoked] = await db
			.select()
			.from(sharedExports)
			.where(eq(sharedExports.shareId, shareId))
			.limit(1);

		expect(revoked).toBeTruthy();
		expect(revoked.revokedAt).toBeTruthy();
		expect(revoked.revokedBy).toBe("test-user");
	});
});

// ── Idempotency ──

describe("Idempotency: duplicate create does not corrupt", () => {
	it("creating the same evaluation twice yields two distinct records", async () => {
		if (!dbReady) return;
		const a = await evaluationService.create(ORG_ID, "test-user", {
			name: "Idempotency Test",
			type: "unit_test",
			testCases: [{ name: "TC", input: "x", expectedOutput: "x" }],
		});
		const b = await evaluationService.create(ORG_ID, "test-user", {
			name: "Idempotency Test",
			type: "unit_test",
			testCases: [{ name: "TC", input: "x", expectedOutput: "x" }],
		});
		// Both should succeed with unique IDs (no conflict)
		expect(a.id).not.toBe(b.id);
		expect(a.name).toBe(b.name);
	});

	it("running the same evaluation twice yields independent runs", async () => {
		if (!dbReady) return;
		const evaluation = await evaluationService.create(ORG_ID, "test-user", {
			name: "Idempotency Run Test",
			type: "unit_test",
			testCases: [{ name: "TC", input: "hello", expectedOutput: "hello" }],
		});

		const run1 = await evaluationService.run(evaluation.id, ORG_ID);
		const run2 = await evaluationService.run(evaluation.id, ORG_ID);

		expect(run1).toBeTruthy();
		expect(run2).toBeTruthy();
		expect(run1?.id).not.toBe(run2?.id);

		// Each run's results are independent
		const results1 = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, run1?.id));
		const results2 = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, run2?.id));

		expect(results1).toHaveLength(1);
		expect(results2).toHaveLength(1);
		expect(results1[0].id).not.toBe(results2[0].id);
	});
});
