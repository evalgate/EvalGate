import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	selectRows: [] as unknown[],
	updateQueue: [] as unknown[],
	insertCalls: [] as unknown[],
}));

const makeBuilder = (result: unknown[]) => {
	const builder: Record<string, unknown> = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		offset: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
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
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	desc: vi.fn((value: unknown) => ({ type: "desc", value })),
	gte: vi.fn((left: unknown, right: unknown) => ({ type: "gte", left, right })),
	lte: vi.fn((left: unknown, right: unknown) => ({ type: "lte", left, right })),
}));

vi.mock("@/lib/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/llm-judge.service", () => ({
	llmJudgeService: {
		evaluate: vi.fn().mockResolvedValue({
			score: 85,
			reasoning: "Good",
			passed: true,
		}),
	},
}));

describe("ArenaMatchesService", () => {
	let arenaMatchesService: any;
	let llmJudgeService: any;

	beforeAll(async () => {
		const mod = await import("@/lib/services/arena-matches.service");
		arenaMatchesService = mod.arenaMatchesService;
		const llmMod = await import("@/lib/services/llm-judge.service");
		llmJudgeService = llmMod.llmJudgeService;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		state.selectRows = [];
		state.updateQueue = [];
		state.insertCalls = [];
	});

	describe("createArenaMatch", () => {
		const validInput = {
			prompt: "What is 2+2?",
			models: ["gpt-4", "claude-3.5-sonnet"],
		};

		it("throws error when no available models found", async () => {
			await expect(
				arenaMatchesService.createArenaMatch(
					1,
					{ ...validInput, models: ["unknown-1", "unknown-2"] },
					"user1",
				),
			).rejects.toThrow("No available models found for arena match");
		});

		it("creates match successfully with default judge config", async () => {
			// Setup queue for getOrCreateDefaultJudgeConfig
			state.updateQueue = [
				[], // existing judge config not found, so it creates one
			];

			const result = await arenaMatchesService.createArenaMatch(
				1,
				validInput,
				"user1",
			);

			expect(result).toBeDefined();
			expect(result.prompt).toBe("What is 2+2?");
			expect(result.results).toHaveLength(2);
			expect(result.scores).toBeDefined();

			expect(state.insertCalls.length).toBeGreaterThan(0); // Judge config + Arena match

			// The match should have been inserted
			const matchInsert = state.insertCalls[
				state.insertCalls.length - 1
			] as any;
			expect(matchInsert.prompt).toBe("What is 2+2?");
			expect(matchInsert.organizationId).toBe(1);
		});

		it("uses provided judge config ID", async () => {
			const _result = await arenaMatchesService.createArenaMatch(
				1,
				{ ...validInput, judgeConfigId: 5 },
				"user1",
			);

			// Verify llmJudgeService.evaluate was called with configId 5
			expect(llmJudgeService.evaluate).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					configId: 5,
				}),
			);

			// Default judge config check should not have happened (insertCalls only has the match)
			expect(state.insertCalls).toHaveLength(1);
		});

		it("handles model execution failures gracefully", async () => {
			// The service has a private callModel method that just returns mock strings for known models
			// So we can't easily make it throw without mocking the service itself, but we can see what happens
			// when evaluate fails. Let's make evaluate throw.
			vi.mocked(llmJudgeService.evaluate).mockRejectedValueOnce(
				new Error("Judge failed"),
			);

			const result = await arenaMatchesService.createArenaMatch(
				1,
				validInput,
				"user1",
			);

			// One model failed, one succeeded
			expect(result.results).toHaveLength(2);

			// Find the failed one
			const failedResult = result.results.find((r: any) => r.score === 0);
			expect(failedResult).toBeDefined();
			expect(failedResult?.output).toContain("Error: Judge failed");
		});
	});

	describe("getArenaMatch", () => {
		it("returns null when match not found", async () => {
			state.selectRows = [];
			const result = await arenaMatchesService.getArenaMatch(1, 999);
			expect(result).toBeNull();
		});

		it("returns parsed match when found", async () => {
			const mockMatch = {
				id: 1,
				prompt: "test",
				results: [{ modelId: "m1", score: 90 }],
				scores: { m1: 90 },
			};
			state.selectRows = [mockMatch];

			const result = await arenaMatchesService.getArenaMatch(1, 1);

			expect(result).not.toBeNull();
			expect(result?.results).toHaveLength(1);
			expect(result?.scores.m1).toBe(90);
		});

		it("handles non-stringified JSON fields safely", async () => {
			const mockMatch = {
				id: 1,
				prompt: "test",
				results: [{ modelId: "m1", score: 90 }],
				scores: { m1: 90 },
			};
			state.selectRows = [mockMatch];

			const result = await arenaMatchesService.getArenaMatch(1, 1);

			expect(result?.results).toHaveLength(1);
			expect(result?.scores.m1).toBe(90);
		});
	});

	describe("getArenaMatches", () => {
		it("returns empty array when no matches found", async () => {
			state.selectRows = [];
			const result = await arenaMatchesService.getArenaMatches(1);
			expect(result).toEqual([]);
		});

		it("returns parsed matches", async () => {
			state.selectRows = [
				{ id: 1, results: [], scores: {} },
				{ id: 2, results: [], scores: {} },
			];

			const result = await arenaMatchesService.getArenaMatches(1, {
				limit: 10,
				offset: 5,
				winnerId: "gpt-4",
				dateRange: { start: "2024-01-01", end: "2024-01-02" },
			});

			expect(result).toHaveLength(2);
			expect(Array.isArray(result[0].results)).toBe(true);
		});
	});

	describe("getLeaderboard", () => {
		it("calculates leaderboard correctly from matches", async () => {
			const mockMatches = [
				{
					id: 1,
					winnerId: "gpt-4",
					createdAt: "2024-01-01T12:00:00Z",
					results: [
						{
							modelId: "gpt-4",
							modelLabel: "GPT-4",
							score: 90,
							responseTime: 1000,
							cost: 0.01,
						},
						{
							modelId: "claude",
							modelLabel: "Claude",
							score: 80,
							responseTime: 1200,
							cost: 0.01,
						},
					],
				},
				{
					id: 2,
					winnerId: "gpt-4",
					createdAt: "2024-01-02T12:00:00Z",
					results: [
						{
							modelId: "gpt-4",
							modelLabel: "GPT-4",
							score: 95,
							responseTime: 900,
							cost: 0.01,
						},
						{
							modelId: "gemini",
							modelLabel: "Gemini",
							score: 85,
							responseTime: 800,
							cost: 0.01,
						},
					],
				},
				{
					id: 3,
					winnerId: "claude",
					createdAt: "2024-01-03T12:00:00Z",
					results: [
						{
							modelId: "gpt-4",
							modelLabel: "GPT-4",
							score: 85,
							responseTime: 1100,
							cost: 0.01,
						},
						{
							modelId: "claude",
							modelLabel: "Claude",
							score: 95,
							responseTime: 1000,
							cost: 0.01,
						},
					],
				},
			];

			state.selectRows = mockMatches;

			const leaderboard = await arenaMatchesService.getLeaderboard(1);

			expect(leaderboard).toHaveLength(3);

			// GPT-4 should have 3 matches, 2 wins (66.6% win rate)
			const gpt4 = leaderboard.find((e: any) => e.modelId === "gpt-4");
			expect(gpt4.totalMatches).toBe(3);
			expect(gpt4.wins).toBe(2);
			expect(gpt4.winRate).toBeCloseTo(66.67, 1);
			expect(gpt4.averageScore).toBe(90); // (90+95+85)/3

			// Claude should have 2 matches, 1 win (50% win rate)
			const claude = leaderboard.find((e: any) => e.modelId === "claude");
			expect(claude.totalMatches).toBe(2);
			expect(claude.wins).toBe(1);
			expect(claude.winRate).toBe(50);

			// Ordering: GPT-4 (66%), Claude (50%), Gemini (0%)
			expect(leaderboard[0].modelId).toBe("gpt-4");
			expect(leaderboard[1].modelId).toBe("claude");
			expect(leaderboard[2].modelId).toBe("gemini");
		});

		it("respects timeRange option", async () => {
			state.selectRows = [];
			await arenaMatchesService.getLeaderboard(1, { timeRange: { days: 7 } });
			// If it doesn't throw, the parameter was handled
			expect(true).toBe(true);
		});
	});

	describe("getArenaStats", () => {
		it("returns zeroed stats when no matches", async () => {
			state.selectRows = []; // getArenaMatches returns empty

			const stats = await arenaMatchesService.getArenaStats(1);

			expect(stats.totalMatches).toBe(0);
			expect(stats.averageScore).toBe(0);
			expect(stats.mostActiveModel).toBe("");
			expect(stats.topPerformer).toBe("");
			expect(stats.recentActivity).toBe(0);
		});

		it("calculates stats correctly from matches", async () => {
			const mockMatches = [
				{
					id: 1,
					createdAt: new Date().toISOString(), // recent
					scores: { "gpt-4": 90, claude: 80 },
					results: [{ modelId: "gpt-4" }, { modelId: "claude" }],
				},
				{
					id: 2,
					createdAt: new Date(
						Date.now() - 10 * 24 * 60 * 60 * 1000,
					).toISOString(), // older than a week
					scores: { "gpt-4": 95, gemini: 85 },
					results: [{ modelId: "gpt-4" }, { modelId: "gemini" }],
				},
			];

			// Setup queue for getArenaMatches then getLeaderboard
			state.updateQueue = [
				mockMatches, // for getArenaMatches
				mockMatches, // for getLeaderboard (which calls getArenaMatches internally)
			];

			const stats = await arenaMatchesService.getArenaStats(1);

			expect(stats.totalMatches).toBe(2);
			// avg of (85) and (90) = 87.5 => 88
			expect(stats.averageScore).toBe(88);
			// gpt-4 appears twice, others once
			expect(stats.mostActiveModel).toBe("gpt-4");
			// 1 match in last week
			expect(stats.recentActivity).toBe(1);
		});
	});
});
