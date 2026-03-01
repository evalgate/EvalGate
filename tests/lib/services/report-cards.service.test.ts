import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	selectRows: [] as unknown[],
	updateQueue: [] as unknown[],
}));

const makeBuilder = (result: unknown[]) => {
	const builder: Record<string, unknown> = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		offset: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		// biome-ignore lint/suspicious/noThenProperty: test mock
		then: (onFulfilled: (value: unknown) => unknown) => {
			return Promise.resolve(result).then(onFulfilled);
		},
	};
	return builder;
};

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() =>
			makeBuilder((state.updateQueue.shift() as unknown[]) ?? state.selectRows),
		),
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	desc: vi.fn((value: unknown) => ({ type: "desc", value })),
	inArray: vi.fn((col: unknown, arr: unknown[]) => ({
		type: "inArray",
		col,
		arr,
	})),
}));

vi.mock("@/lib/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("ReportCardsService", () => {
	let reportCardsService: any;

	beforeAll(async () => {
		const mod = await import("@/lib/services/report-cards.service");
		reportCardsService = mod.reportCardsService;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		state.selectRows = [];
		state.updateQueue = [];
	});

	describe("generateReportCard", () => {
		it("throws error when evaluation not found", async () => {
			state.updateQueue = [[]]; // select evaluation returns empty

			await expect(reportCardsService.generateReportCard(1, 1)).rejects.toThrow(
				"Evaluation not found or access denied",
			);
		});

		it("generates comprehensive report card with no runs", async () => {
			state.updateQueue = [
				[{ id: 1, name: "Test Eval", type: "qa", createdAt: new Date() }], // evaluation
				[{ id: 1, name: "Test Org" }], // organization
				[], // runs
			];

			const report = await reportCardsService.generateReportCard(1, 1);

			expect(report).toBeDefined();
			expect(report.evaluationId).toBe(1);
			expect(report.organizationName).toBe("Test Org");
			expect(report.totalRuns).toBe(0);
			expect(report.averageScore).toBe(0);
			expect(report.passRate).toBe(0);

			// Check performance empty state
			expect(report.performance.scoreDistribution).toEqual({});
			expect(report.performance.costStats.total).toBe(0);

			// Check quality empty state
			expect(report.quality.judgeResults.totalJudged).toBe(0);

			// Check trends empty state
			expect(report.trends.recentPerformance).toHaveLength(0);
		});

		it("calculates metrics correctly with test results and judge results", async () => {
			state.updateQueue = [
				[{ id: 1, name: "Test Eval", type: "qa", createdAt: new Date() }], // evaluation
				[{ id: 1, name: "Test Org" }], // organization
				[
					// runs
					{
						id: 101,
						status: "completed",
						createdAt: "2024-01-02",
						completedAt: "2024-01-02",
					},
					{
						id: 102,
						status: "completed",
						createdAt: "2024-01-01",
						completedAt: "2024-01-01",
					},
				],
				[
					// test results
					{
						id: 1,
						evaluationRunId: 101,
						score: 90,
						status: "passed",
						durationMs: 100,
						metadata: '{"cost": 0.05}',
					},
					{
						id: 2,
						evaluationRunId: 101,
						score: 80,
						status: "passed",
						durationMs: 150,
						metadata: '{"cost": 0.05}',
					},
					{
						id: 3,
						evaluationRunId: 102,
						score: 40,
						status: "failed",
						durationMs: 200,
						metadata: '{"cost": 0.10}',
					},
				],
				[
					// judge results
					{
						id: 1,
						evaluationRunId: 101,
						score: 85,
						metadata: '{"passed": true}',
					},
					{
						id: 2,
						evaluationRunId: 102,
						score: 45,
						metadata: '{"passed": false}',
					},
				],
			];

			const report = await reportCardsService.generateReportCard(1, 1);

			// Basic stats
			expect(report.totalRuns).toBe(2);
			expect(report.completedRuns).toBe(2);

			// Performance stats
			// (90+80+40)/3 = 70
			expect(report.averageScore).toBe(70);
			// 2 passed / 3 total = 66.66...%
			expect(report.passRate).toBeCloseTo(66.67, 1);
			// (100+150+200)/3 = 150
			expect(report.averageDuration).toBe(150);
			// Cost extracted from test result metadata: 0.05 + 0.05 + 0.10 = 0.2
			expect(report.totalCost).toBe(0.2);

			// Score distribution
			expect(report.performance.scoreDistribution["81-100"]).toBe(1); // the 90
			expect(report.performance.scoreDistribution["61-80"]).toBe(1); // the 80
			expect(report.performance.scoreDistribution["21-40"]).toBe(1); // the 40

			// Status distribution
			expect(report.performance.statusDistribution.passed).toBe(2);
			expect(report.performance.statusDistribution.failed).toBe(1);

			// Quality stats
			expect(report.quality.judgeResults.totalJudged).toBe(2);
			// (85+45)/2 = 65
			expect(report.quality.judgeResults.averageJudgeScore).toBe(65);
			expect(report.quality.judgeResults.passedJudged).toBe(1);

			// Consistency metrics
			expect(report.quality.consistency.scoreStdDev).toBeGreaterThan(0);

			// Trends
			expect(report.trends.recentPerformance).toHaveLength(2);
			expect(report.trends.recentPerformance[0].runId).toBe(101);
			// run 101 avg = (90+80)/2 = 85
			expect(report.trends.recentPerformance[0].score).toBe(85);
			// run 102 avg = 40
			expect(report.trends.recentPerformance[1].score).toBe(40);
		});
	});

	describe("generateReportCardSummary", () => {
		it("calculates overall score and grade correctly", async () => {
			// Mock generateReportCard implicitly by letting its internal DB queries return data
			state.updateQueue = [
				[{ id: 1, name: "Test Eval", type: "qa", createdAt: new Date() }], // evaluation
				[{ id: 1, name: "Test Org" }], // organization
				[{ id: 101, status: "completed", createdAt: "2024-01-01" }], // runs
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 95,
						status: "passed",
						durationMs: 100,
					},
				], // test results
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 90,
						metadata: '{"passed": true}',
					},
				], // judge results
			];

			const summary = await reportCardsService.generateReportCardSummary(1, 1);

			expect(summary.evaluationId).toBe(1);
			expect(summary.evaluationName).toBe("Test Eval");

			// Weights: avgScore (0.4) + passRate (0.3) + consistency (0.2) + judgeQuality (0.1)
			// avgScore=95 -> 95 * 0.4 = 38
			// passRate=100 -> 100 * 0.3 = 30
			// consistency -> variance 0 -> coeff 0 -> 100 * 0.2 = 20
			// judgeQuality=90 -> 90 * 0.1 = 9
			// Total = 38 + 30 + 20 + 9 = 97

			expect(summary.overallScore).toBe(97);
			expect(summary.grade).toBe("A+");
			expect(summary.status).toBe("excellent");
			expect(summary.keyMetrics.averageScore).toBe(95);
			expect(summary.keyMetrics.passRate).toBe(100);
		});

		it("assigns lower grades for poorer performance", async () => {
			state.updateQueue = [
				[{ id: 1, name: "Test Eval", type: "qa", createdAt: new Date() }], // evaluation
				[{ id: 1, name: "Test Org" }], // organization
				[{ id: 101, status: "completed", createdAt: "2024-01-01" }], // runs
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 40,
						status: "failed",
						durationMs: 100,
					},
				], // test results
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 30,
						metadata: '{"passed": false}',
					},
				], // judge results
			];

			const summary = await reportCardsService.generateReportCardSummary(1, 1);

			expect(summary.overallScore).toBeLessThan(70);
			expect(["D", "F"]).toContain(summary.grade);
			expect(summary.status).toBe("poor");
		});
	});

	describe("getReportCards", () => {
		it("returns empty array when no evaluations found", async () => {
			state.updateQueue = [[]]; // evaluations
			const cards = await reportCardsService.getReportCards(1);
			expect(cards).toEqual([]);
		});

		it("generates summaries for multiple evaluations", async () => {
			state.updateQueue = [
				[
					// evaluations list
					{ id: 1, name: "Eval 1", type: "qa", createdAt: new Date() },
					{ id: 2, name: "Eval 2", type: "coding", createdAt: new Date() },
				],
				// DB calls for Eval 1 generateReportCard (3 calls because runs is empty)
				[{ id: 1, name: "Eval 1" }],
				[{ id: 1 }],
				[],
				// DB calls for Eval 2 generateReportCard (3 calls because runs is empty)
				[{ id: 2, name: "Eval 2" }],
				[{ id: 1 }],
				[],
			];

			const cards = await reportCardsService.getReportCards(1);

			expect(cards).toHaveLength(2);
			expect(cards[0].evaluationId).toBe(1);
			expect(cards[1].evaluationId).toBe(2);
		});

		it("skips evaluations that throw errors during generation", async () => {
			state.updateQueue = [
				[
					// evaluations list
					{ id: 1, name: "Eval 1", type: "qa", createdAt: new Date() },
					{ id: 2, name: "Eval 2", type: "coding", createdAt: new Date() },
				],
				// DB calls for Eval 1 generateReportCard (make it fail by returning empty eval)
				[],
				// DB calls for Eval 2 generateReportCard (3 calls)
				[{ id: 2, name: "Eval 2" }],
				[{ id: 1 }],
				[],
			];

			const cards = await reportCardsService.getReportCards(1);

			// Eval 1 failed, so only Eval 2 should be returned
			expect(cards).toHaveLength(1);
			expect(cards[0].evaluationId).toBe(2);
		});
	});

	describe("getReportCardStats", () => {
		it("returns zeroed stats when no report cards exist", async () => {
			state.updateQueue = [[]]; // getReportCards evaluations query

			const stats = await reportCardsService.getReportCardStats(1);

			expect(stats.totalEvaluations).toBe(0);
			expect(stats.averageScore).toBe(0);
			expect(stats.gradeDistribution).toEqual({});
			expect(stats.topPerformers).toEqual([]);
			expect(stats.recentActivity).toBe(0);
		});

		it("calculates stats correctly from multiple report cards", async () => {
			state.updateQueue = [
				[
					// evaluations list
					{ id: 1, name: "Eval 1", type: "qa", createdAt: new Date() },
					{ id: 2, name: "Eval 2", type: "coding", createdAt: new Date() },
				],
				// DB calls for Eval 1 -> Score 97 (A+) -> 5 calls because runs exist
				[{ id: 1, name: "Eval 1", type: "qa", createdAt: new Date() }],
				[{ id: 1 }],
				[{ id: 101, status: "completed", createdAt: new Date().toISOString() }],
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 95,
						status: "passed",
						durationMs: 100,
						metadata: { cost: 0.05 },
					},
				],
				[
					{
						id: 1,
						evaluationRunId: 101,
						score: 90,
						metadata: { passed: true },
					},
				],
				// DB calls for Eval 2 -> Score ~48 (F) -> 5 calls because runs exist
				[{ id: 2, name: "Eval 2", type: "qa", createdAt: new Date() }],
				[{ id: 1 }],
				[
					{
						id: 102,
						status: "completed",
						createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
					},
				], // old run
				[
					{
						id: 2,
						evaluationRunId: 102,
						score: 40,
						status: "failed",
						durationMs: 100,
						metadata: { cost: 0.05 },
					},
				],
				[
					{
						id: 2,
						evaluationRunId: 102,
						score: 30,
						metadata: { passed: false },
					},
				],
			];

			const stats = await reportCardsService.getReportCardStats(1);

			expect(stats.totalEvaluations).toBe(2);

			// Avg score = (97 + approx 48) / 2
			expect(stats.averageScore).toBeGreaterThan(0);

			// Grade distribution
			expect(stats.gradeDistribution["A+"]).toBe(1);

			// Top performers sorting
			expect(stats.topPerformers).toHaveLength(2);
			expect(stats.topPerformers[0].evaluationId).toBe(1); // Eval 1 scored higher
			expect(stats.topPerformers[1].evaluationId).toBe(2);

			// Recent activity (generatedAt for both is recent)
			expect(stats.recentActivity).toBe(2);
		});
	});
});
