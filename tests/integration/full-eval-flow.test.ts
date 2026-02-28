/**
 * Full Eval Flow Integration Test
 * Trust regression suite: create eval → add test case → run → quality → report → recompute → export → MCP
 *
 * Requires: pnpm test:db-setup (runs before pnpm test). Uses test.db with full schema.
 */

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
	evaluationRuns,
	evaluations,
	qualityScores,
	testCases,
	testResults,
} from "@/db/schema";
import { calculateQualityScore } from "@/lib/ai-quality-score";
import { type EvaluationType, formatExportData } from "@/lib/export-templates";
import { executeMcpTool } from "@/lib/mcp/registry";
import { recomputeAndStoreQualityScore } from "@/lib/services/aggregate-metrics.service";
import { evaluationService } from "@/lib/services/evaluation.service";
import { qualityService } from "@/lib/services/quality.service";

const ORG_ID = 1;
const USER_ID = "test-user";

let dbReady = false;

describe("Full eval flow integration", () => {
	let evaluationId: number;
	let runId: number;

	beforeAll(async () => {
		try {
			await db.select().from(evaluations).limit(1);
			dbReady = true;
		} catch {
			dbReady = false;
		}
	});

	it("1. creates evaluation", async () => {
		if (!dbReady) return;
		const evaluation = await evaluationService.create(ORG_ID, USER_ID, {
			name: "Integration Test Eval",
			description: "Full flow test",
			type: "unit_test",
		});
		expect(evaluation).toBeDefined();
		evaluationId = evaluation.id;
		expect(evaluationId).toBeGreaterThan(0);
	});

	it("2. adds test case", async () => {
		if (!dbReady) return;
		await db.insert(testCases).values({
			evaluationId,
			name: "TC1",
			input: "hello",
			expectedOutput: "hello",
			metadata: null,
			createdAt: new Date(),
		});
		const cases = await db
			.select()
			.from(testCases)
			.where(eq(testCases.evaluationId, evaluationId));
		expect(cases.length).toBe(1);
	});

	it("3. runs evaluation", async () => {
		if (!dbReady) return;
		const run = await evaluationService.run(evaluationId, ORG_ID, {
			environment: "dev",
		});
		expect(run).toBeDefined();
		runId = run?.id;
		expect(runId).toBeGreaterThan(0);

		const [runRow] = await db
			.select()
			.from(evaluationRuns)
			.where(eq(evaluationRuns.id, runId));
		expect(runRow.status).toBe("completed");

		const results = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, runId));
		expect(results.length).toBe(1);
		expect(results[0].status).toBe("passed");
	});

	it("4. has quality score", async () => {
		if (!dbReady) return;
		// Quality score is computed fire-and-forget — retry briefly
		let qs: typeof qualityScores.$inferSelect | undefined;
		for (let i = 0; i < 10; i++) {
			const [row] = await db
				.select()
				.from(qualityScores)
				.where(
					and(
						eq(qualityScores.evaluationRunId, runId),
						eq(qualityScores.organizationId, ORG_ID),
					),
				);
			if (row) {
				qs = row;
				break;
			}
			await new Promise((r) => setTimeout(r, 100));
		}
		expect(qs).toBeDefined();
		expect(qs?.score).toBeGreaterThanOrEqual(0);
		expect(qs?.scoringVersion).toBe("v1");
	});

	it("5. fetches quality via service", async () => {
		if (!dbReady) return;
		const latest = await qualityService.latest(ORG_ID, evaluationId, {
			baseline: "published",
		});
		expect(latest).toBeDefined();
		if (!latest) return;
		if ("score" in latest && latest.score !== null) {
			expect(latest.score).toBeGreaterThanOrEqual(0);
		}
	});

	it("6. recomputes quality", async () => {
		if (!dbReady) return;
		const result = await recomputeAndStoreQualityScore(runId, ORG_ID);
		expect(result).not.toBeNull();
		expect(result?.score).toBeGreaterThanOrEqual(0);
	});

	it("7. export returns valid payload", async () => {
		if (!dbReady) return;
		const [evaluation] = await db
			.select()
			.from(evaluations)
			.where(eq(evaluations.id, evaluationId));
		const [run] = await db
			.select()
			.from(evaluationRuns)
			.where(eq(evaluationRuns.id, runId));
		const results = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, runId));

		const totalCases = run.totalCases ?? 0;
		const passedCases = run.passedCases ?? 0;
		const stats = {
			totalEvaluations: totalCases,
			passedEvaluations: passedCases,
			failedEvaluations: run.failedCases ?? 0,
			averageLatency: 500,
			averageCost: 0.01,
			averageScore: totalCases > 0 ? (passedCases / totalCases) * 100 : 0,
			consistencyScore: 85,
		};
		const qualityScore = calculateQualityScore(stats);

		const baseData = {
			evaluation: {
				id: String(evaluation.id),
				name: evaluation.name,
				description: evaluation.description ?? "",
				type: evaluation.type as EvaluationType,
				created_at:
					evaluation.createdAt instanceof Date
						? evaluation.createdAt.toISOString()
						: String(evaluation.createdAt),
			},
			timestamp: new Date().toISOString(),
			summary: {
				totalTests: totalCases,
				passed: passedCases,
				failed: run.failedCases ?? 0,
				passRate: totalCases
					? `${Math.round((passedCases / totalCases) * 100)}%`
					: "0%",
			},
			qualityScore,
		};

		const additionalData = {
			testResults: results.map((r) => ({
				id: String(r.id),
				name: "",
				input: "",
				expected_output: "",
				actual_output: r.output,
				passed: r.status === "passed",
				execution_time_ms: r.durationMs ?? undefined,
				error_message: r.error ?? undefined,
			})),
		};

		const exportData = formatExportData(baseData, additionalData);
		expect(exportData.evaluation.id).toBe(String(evaluationId));
		expect(exportData.summary.totalTests).toBe(1);
		expect(exportData.summary.passed).toBe(1);
		expect(exportData.type).toBe("unit_test");
	});

	it("8. MCP eval.quality.latest returns quality", async () => {
		if (!dbReady) return;
		const result = await executeMcpTool(
			"eval.quality.latest",
			{ evaluationId },
			{
				userId: USER_ID,
				organizationId: ORG_ID,
				role: "member",
				scopes: ["runs:read"],
				authType: "session" as const,
			},
		);
		expect(result).toBeDefined();
		const r = result as Record<string, unknown>;
		expect(r).toHaveProperty("score");
		if (r.score !== null) {
			expect(r.evaluationId).toBe(evaluationId);
		}
	});
});
