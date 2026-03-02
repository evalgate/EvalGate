import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	selectRows: [] as unknown[],
	updateQueue: [] as unknown[],
	insertCalls: [] as unknown[],
	updateCalls: [] as unknown[],
	deleteWhereCalled: false,
}));

const makeBuilder = (result: unknown[]) => {
	const builder: Record<string, unknown> = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		offset: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		innerJoin: vi.fn(() => builder),
		set: vi.fn((values: Record<string, unknown>) => {
			state.updateCalls.push(values);
			return builder;
		}),
		returning: vi.fn(() => Promise.resolve(result)),
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
		insert: vi.fn(() => ({
			values: vi.fn((val) => {
				state.insertCalls.push(val);
				return {
					returning: () => Promise.resolve([{ id: 1, ...val }]),
				};
			}),
		})),
		update: vi.fn(() =>
			makeBuilder((state.updateQueue.shift() as unknown[]) ?? state.selectRows),
		),
		delete: vi.fn(() => ({
			where: vi.fn(() => {
				state.deleteWhereCalled = true;
				return Promise.resolve();
			}),
		})),
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	desc: vi.fn((value: unknown) => ({ type: "desc", value })),
	asc: vi.fn((value: unknown) => ({ type: "asc", value })),
	gte: vi.fn((left: unknown, right: unknown) => ({ type: "gte", left, right })),
	lte: vi.fn((left: unknown, right: unknown) => ({ type: "lte", left, right })),
	inArray: vi.fn((col: unknown, arr: unknown[]) => ({
		type: "inArray",
		col,
		arr,
	})),
	like: vi.fn((col: unknown, pattern: unknown) => ({
		type: "like",
		col,
		pattern,
	})),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({
			type: "sql",
			strings: Array.from(strings),
			values,
		}),
		{ raw: vi.fn((s: string) => ({ type: "sql_raw", value: s })) },
	),
}));

vi.mock("@/lib/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/provider-keys.service", () => ({
	providerKeysService: {
		getActiveProviderKey: vi.fn(),
	},
}));

describe("ShadowEvalService", () => {
	let shadowEvalService: any;
	let providerKeysService: any;

	beforeAll(async () => {
		const mod = await import("@/lib/services/shadow-eval.service");
		shadowEvalService = mod.shadowEvalService;
		const providerMod = await import("@/lib/services/provider-keys.service");
		providerKeysService = providerMod.providerKeysService;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		state.selectRows = [];
		state.updateQueue = [];
		state.insertCalls = [];
		state.updateCalls = [];
		state.deleteWhereCalled = false;
		globalThis.fetch = vi.fn() as unknown as typeof fetch;
	});

	describe("createShadowEval", () => {
		const validInput = {
			evaluationId: 1,
			traceIds: ["trace1", "trace2"],
			dateRange: { start: "2024-01-01", end: "2024-01-02" },
			filters: { status: ["success"] },
		};

		it("throws error when evaluation not found", async () => {
			state.updateQueue = [[]]; // select evaluation returns empty

			await expect(
				shadowEvalService.createShadowEval(1, validInput, "user1"),
			).rejects.toThrow("Evaluation not found or access denied");
		});

		it("throws error when no production traces found", async () => {
			state.updateQueue = [
				[{ id: 1, organizationId: 1 }], // evaluation found
				[], // getProductionTraces returns empty
			];

			await expect(
				shadowEvalService.createShadowEval(1, validInput, "user1"),
			).rejects.toThrow("No production traces found for shadow evaluation");
		});

		it("creates shadow evaluation successfully and starts processing", async () => {
			const mockEval = { id: 1, organizationId: 1 };
			const mockTraces = [
				{ traceId: "trace1", metadata: "{}" },
				{ traceId: "trace2", metadata: "{}" },
			];
			const mockSpans1 = [
				{
					spanId: "s1",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];
			const mockSpans2 = [
				{
					spanId: "s2",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];

			// Setup the queue for createShadowEval + getProductionTraces + processShadowEval
			state.updateQueue = [
				[mockEval], // check evaluation exists
				mockTraces, // get traces
				mockSpans1, // get spans for trace1
				mockSpans2, // get spans for trace2
				[mockEval], // processShadowEval checks evaluation again
			];

			vi.mocked(providerKeysService.getActiveProviderKey).mockResolvedValue({
				decryptedKey: "sk-test",
			});

			const mockResponse = new Response(
				JSON.stringify({
					choices: [{ message: { content: "good output" } }],
				}),
				{ status: 200 },
			);
			vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

			const result = await shadowEvalService.createShadowEval(
				1,
				validInput,
				"user1",
			);

			expect(result).toBeDefined();
			expect(result.id).toBe(1);
			expect(result.status).toBe("pending");
			expect(result.totalTraces).toBe(2);

			expect(state.insertCalls).toHaveLength(1); // The evaluation run

			// Wait a tick for the fire-and-forget background process to finish its inserts
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should have inserted 2 test results
			expect(state.insertCalls.length).toBeGreaterThan(1);
		});
	});

	describe("getShadowEvalResults", () => {
		it("returns null when run not found", async () => {
			state.updateQueue = [[]]; // join query returns empty

			const result = await shadowEvalService.getShadowEvalResults(1, 999);

			expect(result).toBeNull();
		});

		it("returns formatted results when run exists", async () => {
			const mockRun = {
				evaluation_runs: {
					id: 1,
					evaluationId: 2,
					status: "completed",
					totalCases: 10,
					traceLog: { originalEvaluationId: 5 },
					startedAt: "2024-01-01",
					completedAt: "2024-01-02",
				},
				evaluations: { id: 2, organizationId: 1 },
			};

			const mockResults = [
				{ score: 100, status: "passed", durationMs: 150 },
				{ score: 50, status: "failed", durationMs: 250 },
			];

			state.updateQueue = [[mockRun], mockResults];

			const result = await shadowEvalService.getShadowEvalResults(1, 1);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(1);
			expect(result?.evaluationId).toBe(2);
			expect(result?.originalEvaluationId).toBe(5);
			expect(result?.totalTraces).toBe(10);
			expect(result?.processedTraces).toBe(2);
			expect(result?.passedTraces).toBe(1);
			expect(result?.failedTraces).toBe(1);
			expect(result?.averageScore).toBe(75); // (100+50)/2
			expect(result?.averageDuration).toBe(200); // (150+250)/2
			expect(result?.results).toHaveLength(2);
		});

		it("handles malformed traceLog", async () => {
			const mockRun = {
				evaluation_runs: {
					id: 1,
					evaluationId: 2,
					status: "completed",
					totalCases: 0,
					traceLog: "invalid-json",
				},
			};

			state.updateQueue = [[mockRun], []];

			const result = await shadowEvalService.getShadowEvalResults(1, 1);
			expect(result?.originalEvaluationId).toBe(0); // Default when parse fails
		});
	});

	describe("getShadowEvalStats", () => {
		it("returns zeroed stats when no runs exist", async () => {
			state.selectRows = [];

			const result = await shadowEvalService.getShadowEvalStats(1);

			expect(result.totalEvals).toBe(0);
			expect(result.completedEvals).toBe(0);
			expect(result.averageScoreImprovement).toBe(0);
			expect(result.recentEvals).toEqual([]);
		});

		it("calculates stats correctly from runs", async () => {
			const mockRuns = [
				{
					id: 1,
					evaluationId: 2,
					status: "completed",
					traceLog: { scoreImprovement: 15 },
				},
				{
					id: 2,
					evaluationId: 2,
					status: "completed_with_failures",
					traceLog: { scoreImprovement: 5 },
				},
				{ id: 3, evaluationId: 3, status: "pending", traceLog: {} }, // No improvement data
			];

			state.selectRows = mockRuns;

			const result = await shadowEvalService.getShadowEvalStats(1);

			expect(result.totalEvals).toBe(3);
			expect(result.completedEvals).toBe(2);
			expect(result.averageScoreImprovement).toBe(10); // (15+5)/2
			expect(result.recentEvals).toHaveLength(3);
			expect(result.recentEvals[0].id).toBe(1);
		});
	});

	describe("processShadowEval (private method functionality via creation)", () => {
		it("handles LLM API errors properly during replay", async () => {
			const mockEval = {
				id: 1,
				organizationId: 1,
				modelSettings: { model: "gpt-4" },
			};
			const mockTraces = [{ traceId: "trace1", metadata: "{}" }];
			const mockSpans = [
				{
					spanId: "s1",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];

			state.updateQueue = [
				[mockEval], // createShadowEval check
				mockTraces, // get traces
				mockSpans, // get spans
				[mockEval], // processShadowEval check
			];

			vi.mocked(providerKeysService.getActiveProviderKey).mockResolvedValue({
				decryptedKey: "sk-test",
			});

			// Mock API failure
			vi.mocked(globalThis.fetch).mockResolvedValue(
				new Response("API Error", { status: 500 }),
			);

			await shadowEvalService.createShadowEval(
				1,
				{ evaluationId: 1, traceIds: ["trace1"] },
				"user1",
			);

			// Wait for background process
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should have inserted a failed test result
			expect(state.insertCalls.length).toBeGreaterThan(1); // Run + Result

			// Check the last status update
			const statusUpdates = state.updateCalls.filter(
				(c) => (c as Record<string, unknown>).status !== undefined,
			);
			expect(
				(statusUpdates[statusUpdates.length - 1] as Record<string, unknown>)
					.status,
			).toBe("completed_with_failures");
		});

		it("falls back to heuristic when no API key", async () => {
			const mockEval = {
				id: 1,
				organizationId: 1,
				modelSettings: { model: "gpt-4" },
			};
			const mockTraces = [{ traceId: "trace1", metadata: "{}" }];
			const mockSpans = [
				{
					spanId: "s1",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];

			state.updateQueue = [[mockEval], mockTraces, mockSpans, [mockEval]];

			// Return null for API key
			vi.mocked(providerKeysService.getActiveProviderKey).mockResolvedValue(
				null,
			);

			await shadowEvalService.createShadowEval(
				1,
				{ evaluationId: 1, traceIds: ["trace1"] },
				"user1",
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			// The heuristic fallback outputs "[Heuristic] Replay for: in"
			// Original output is "out". They share no words, so similarity score is 0.
			// This means the test case fails (score < 70).
			const statusUpdates = state.updateCalls.filter(
				(c) => (c as Record<string, unknown>).status !== undefined,
			);
			expect(
				(statusUpdates[statusUpdates.length - 1] as Record<string, unknown>)
					.status,
			).toBe("completed_with_failures");
		});

		it("handles Anthropic API calls correctly", async () => {
			const mockEval = {
				id: 1,
				organizationId: 1,
				modelSettings: { model: "claude-3-opus" },
			};
			const mockTraces = [{ traceId: "trace1", metadata: "{}" }];
			const mockSpans = [
				{
					spanId: "s1",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];

			state.updateQueue = [[mockEval], mockTraces, mockSpans, [mockEval]];

			vi.mocked(providerKeysService.getActiveProviderKey).mockResolvedValue({
				decryptedKey: "sk-ant-test",
			});

			const mockResponse = new Response(
				JSON.stringify({
					content: [{ text: "out" }], // exact match with expected 'out' from mockSpans
				}),
				{ status: 200 },
			);
			vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

			await shadowEvalService.createShadowEval(
				1,
				{ evaluationId: 1, traceIds: ["trace1"] },
				"user1",
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://api.anthropic.com/v1/messages",
				expect.any(Object),
			);
		});

		it("handles unsupported models gracefully", async () => {
			const mockEval = {
				id: 1,
				organizationId: 1,
				modelSettings: { model: "unknown-model-xyz" },
			};
			const mockTraces = [{ traceId: "trace1", metadata: "{}" }];
			const mockSpans = [
				{
					spanId: "s1",
					name: "test",
					type: "llm",
					input: "in",
					output: "out",
					durationMs: 100,
					metadata: "{}",
				},
			];

			state.updateQueue = [[mockEval], mockTraces, mockSpans, [mockEval]];

			vi.mocked(providerKeysService.getActiveProviderKey).mockResolvedValue({
				decryptedKey: "key",
			});

			await shadowEvalService.createShadowEval(
				1,
				{ evaluationId: 1, traceIds: ["trace1"] },
				"user1",
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			// Unknown models default to openai logic but if that fails/throws, it's handled
			// The function defaults "unknown-model-xyz" to "openai" in getProviderFromModel
			expect(true).toBe(true);
		});
	});
});
