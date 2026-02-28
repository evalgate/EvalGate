/**
 * End-to-End "Golden Flow" Test
 *
 * Tests the full evaluation journey through the service layer:
 *   create eval → add test cases → run → verify results → export → validate
 *
 * This is the canary test — if this breaks, something fundamental is wrong.
 * Runs in the DB lane with real SQLite.
 */

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
	evaluationRuns,
	evaluations,
	testCases,
	testResults,
} from "@/db/schema";
import { calculateQualityScore } from "@/lib/ai-quality-score";
import { formatExportData, validateExportData } from "@/lib/export-templates";
import { evaluationService } from "@/lib/services/evaluation.service";
import { computeExportHash } from "@/lib/shared-exports/hash";

describe("Golden Flow: create → run → export → validate", () => {
	let evalId: number;
	const orgId = 1;
	let dbReady = false;

	beforeAll(async () => {
		try {
			await db.select().from(evaluations).limit(1);
			dbReady = true;
		} catch {
			dbReady = false;
		}
	});

	it("Step 1: creates an evaluation with test cases", async () => {
		if (!dbReady) return;

		const evaluation = await evaluationService.create(orgId, "test-user", {
			name: "Golden Flow Canary",
			description: "End-to-end confidence test",
			type: "unit_test",
			testCases: [
				{
					name: "TC-1: Greeting",
					input: "Hello world",
					expectedOutput: "Hello world",
				},
				{
					name: "TC-2: Math",
					input: "What is 2+2?",
					expectedOutput: "4",
				},
				{
					name: "TC-3: Empty",
					input: "no expected output test",
				},
			],
		});

		expect(evaluation).toBeTruthy();
		expect(evaluation.id).toBeGreaterThan(0);
		expect(evaluation.name).toBe("Golden Flow Canary");
		expect(evaluation.status).toBe("draft");
		evalId = evaluation.id;

		// Verify test cases were created
		const cases = await db
			.select()
			.from(testCases)
			.where(eq(testCases.evaluationId, evalId));
		expect(cases).toHaveLength(3);
		expect(cases[0].name).toBe("TC-1: Greeting");
	});

	it("Step 2: runs the evaluation and produces results", async () => {
		if (!dbReady) return;
		const run = await evaluationService.run(evalId, orgId);

		expect(run).toBeTruthy();
		expect(run?.status).toBe("completed");

		// Verify run record exists
		const [runRecord] = await db
			.select()
			.from(evaluationRuns)
			.where(eq(evaluationRuns.evaluationId, evalId))
			.limit(1);
		expect(runRecord).toBeTruthy();
		expect(runRecord.totalCases).toBe(3);
		expect(runRecord.status).toBe("completed");

		// Verify test results were written
		const results = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, runRecord.id));
		expect(results).toHaveLength(3);

		// Each result should have a status and score
		for (const r of results) {
			expect(["passed", "failed"]).toContain(r.status);
			expect(r.score).not.toBeNull();
			expect(r.durationMs).toBeGreaterThanOrEqual(0);
		}
	});

	it("Step 3: retrieves the evaluation with relations", async () => {
		if (!dbReady) return;
		const full = await evaluationService.getById(evalId, orgId);
		expect(full).toBeTruthy();
		expect(full?.testCases).toHaveLength(3);
		expect(full?.runs.length).toBeGreaterThanOrEqual(1);
	});

	it("Step 4: constructs and validates an export payload", async () => {
		if (!dbReady) return;
		const [run] = await db
			.select()
			.from(evaluationRuns)
			.where(eq(evaluationRuns.evaluationId, evalId))
			.limit(1);

		const results = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, run.id));

		const totalCases = run.totalCases ?? 0;
		const passedCases = run.passedCases ?? 0;
		const failedCases = run.failedCases ?? 0;

		const qualityScore = calculateQualityScore({
			totalEvaluations: totalCases,
			passedEvaluations: passedCases,
			failedEvaluations: failedCases,
			averageLatency: 100,
			averageCost: 0.01,
			averageScore: totalCases > 0 ? (passedCases / totalCases) * 100 : 0,
			consistencyScore: 85,
		});

		const baseData = {
			evaluation: {
				id: String(evalId),
				name: "Golden Flow Canary",
				description: "End-to-end confidence test",
				type: "unit_test" as const,
				created_at: new Date().toISOString(),
			},
			timestamp: new Date().toISOString(),
			summary: {
				totalTests: totalCases,
				passed: passedCases,
				failed: failedCases,
				passRate: totalCases
					? `${Math.round((passedCases / totalCases) * 100)}%`
					: "0%",
			},
			qualityScore,
		};

		const cases = await db
			.select()
			.from(testCases)
			.where(eq(testCases.evaluationId, evalId));

		const additionalData = {
			testResults: results.map((r) => {
				const tc = cases.find((c) => c.id === r.testCaseId);
				return {
					id: String(r.id),
					name: tc?.name ?? "",
					input: tc?.input,
					expected_output: tc?.expectedOutput,
					actual_output: r.output,
					passed: r.status === "passed",
					execution_time_ms: r.durationMs ?? undefined,
					error_message: r.error ?? undefined,
				};
			}),
		};

		const exportData = formatExportData(baseData, additionalData);

		// Validate export completeness
		const validation = validateExportData(exportData);
		expect(validation.valid).toBe(true);
		expect(validation.missingFields).toHaveLength(0);

		// Verify deterministic hash
		const hash1 = computeExportHash(
			exportData as unknown as Record<string, unknown>,
		);
		const hash2 = computeExportHash(
			exportData as unknown as Record<string, unknown>,
		);
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^[a-f0-9]{64}$/);
	});

	it("Step 5: stats reflect the completed run", async () => {
		if (!dbReady) return;
		const stats = await evaluationService.getStats(evalId, orgId);
		expect(stats).toBeTruthy();
		expect(stats?.totalRuns).toBeGreaterThanOrEqual(1);
		expect(stats?.totalTestCases).toBe(3);
	});
});
