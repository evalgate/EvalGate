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
    leftJoin: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
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
    select: vi.fn(() => makeBuilder((state.updateQueue.shift() as unknown[]) ?? state.selectRows)),
    insert: vi.fn(() => ({
      values: vi.fn((val) => {
        state.insertCalls.push(val);
        return {
          returning: () => Promise.resolve([{ id: 1, ...val }]),
        };
      }),
    })),
    update: vi.fn(() => makeBuilder((state.updateQueue.shift() as unknown[]) ?? state.selectRows)),
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
  inArray: vi.fn((col: unknown, arr: unknown[]) => ({ type: "inArray", col, arr })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

describe("BenchmarkService", () => {
  let benchmarkService: any;
  let checkSLAViolations: any;
  let getWorkflowSLAStatus: any;

  beforeAll(async () => {
    const mod = await import("@/lib/services/benchmark.service");
    benchmarkService = mod.benchmarkService;
    checkSLAViolations = mod.checkSLAViolations;
    getWorkflowSLAStatus = mod.getWorkflowSLAStatus;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectRows = [];
    state.updateQueue = [];
    state.insertCalls = [];
    state.updateCalls = [];
    state.deleteWhereCalled = false;
  });

  describe("Benchmarks CRUD", () => {
    it("listBenchmarks returns benchmarks", async () => {
      const mockBenchmarks = [{ id: 1, name: "BM1" }];
      state.selectRows = mockBenchmarks;

      const result1 = await benchmarkService.listBenchmarks(1, true);
      const result2 = await benchmarkService.listBenchmarks(1, false);

      expect(result1).toEqual(mockBenchmarks);
      expect(result2).toEqual(mockBenchmarks);
    });

    it("getBenchmarkById returns single benchmark", async () => {
      state.selectRows = [{ id: 1, name: "BM1" }];
      const result = await benchmarkService.getBenchmarkById(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it("getBenchmarkById returns null if not found", async () => {
      state.selectRows = [];
      const result = await benchmarkService.getBenchmarkById(999);
      expect(result).toBeNull();
    });

    it("createBenchmark inserts and returns new benchmark", async () => {
      const result = await benchmarkService.createBenchmark({
        name: "New BM",
        organizationId: 1,
        taskType: "qa",
        metrics: ["accuracy"],
        createdBy: "user1",
      });

      expect(result).toBeDefined();
      expect(state.insertCalls).toHaveLength(1);
      const inserted = state.insertCalls[0] as any;
      expect(inserted.name).toBe("New BM");
      expect(inserted.taskType).toBe("qa");
      expect(inserted.isPublic).toBe(false);
    });

    it("deleteBenchmark returns false if not found or org mismatch", async () => {
      state.updateQueue = [[]]; // getBenchmarkById returns null
      const res1 = await benchmarkService.deleteBenchmark(1, 1);
      expect(res1).toBe(false);

      state.updateQueue = [[{ id: 1, organizationId: 2 }]]; // diff org
      const res2 = await benchmarkService.deleteBenchmark(1, 1);
      expect(res2).toBe(false);
    });

    it("deleteBenchmark deletes when authorized", async () => {
      state.updateQueue = [[{ id: 1, organizationId: 1 }]];
      const res = await benchmarkService.deleteBenchmark(1, 1);
      expect(res).toBe(true);
      expect(state.deleteWhereCalled).toBe(true);
    });
  });

  describe("AgentConfigs CRUD", () => {
    it("listAgentConfigs returns configs", async () => {
      state.selectRows = [{ id: 1, name: "Agent1" }];
      const result = await benchmarkService.listAgentConfigs(1);
      expect(result).toHaveLength(1);
    });

    it("getAgentConfigById returns single config or null", async () => {
      state.updateQueue = [[{ id: 1 }], []];
      const res1 = await benchmarkService.getAgentConfigById(1);
      const res2 = await benchmarkService.getAgentConfigById(999);
      expect(res1?.id).toBe(1);
      expect(res2).toBeNull();
    });

    it("createAgentConfig inserts new config", async () => {
      await benchmarkService.createAgentConfig({
        name: "Agent 1",
        organizationId: 1,
        architecture: "react",
        model: "gpt-4",
        createdBy: "user1",
      });
      expect(state.insertCalls).toHaveLength(1);
      const inserted = state.insertCalls[0] as any;
      expect(inserted.architecture).toBe("react");
    });

    it("deleteAgentConfig works with auth check", async () => {
      state.updateQueue = [[{ id: 1, organizationId: 1 }]];
      const res = await benchmarkService.deleteAgentConfig(1, 1);
      expect(res).toBe(true);
      expect(state.deleteWhereCalled).toBe(true);
    });
  });

  describe("submitResult", () => {
    const input = {
      benchmarkId: 1,
      agentConfigId: 2,
      accuracy: 80,
      latencyP50: 100,
      totalCost: "0.05",
      successRate: 90,
      toolUseEfficiency: 85,
    };

    it("creates new result if none exists", async () => {
      state.updateQueue = [[]]; // existing check

      const result = await benchmarkService.submitResult(input);

      expect(result).toBeDefined();
      expect(state.insertCalls).toHaveLength(1);
      const inserted = state.insertCalls[0] as any;
      expect(inserted.benchmarkId).toBe(1);
      expect(inserted.accuracy).toBe(80);
      expect(inserted.runCount).toBe(1);
    });

    it("updates existing result and averages metrics", async () => {
      const existing = {
        id: 10,
        runCount: 1,
        accuracy: 90,
        latencyP50: 200,
        totalCost: "0.05",
        successRate: 100,
        toolUseEfficiency: 95,
      };

      state.updateQueue = [
        [existing], // existing check
        [{ id: 10, ...input }], // update returning
      ];

      const result = await benchmarkService.submitResult(input);

      expect(result).toBeDefined();
      expect(state.updateCalls).toHaveLength(1);
      const updated = state.updateCalls[0] as any;

      // Should average (90+80)/2 = 85
      expect(updated.accuracy).toBe(85);
      // (200+100)/2 = 150
      expect(updated.latencyP50).toBe(150);
      // 0.05 + 0.05 = 0.100000
      expect(updated.totalCost).toBe("0.100000");
      expect(updated.runCount).toBe(2);
    });
  });

  describe("getLeaderboard", () => {
    it("calculates composite scores and assigns ranks", async () => {
      const mockResults = [
        {
          result: {
            accuracy: 90,
            successRate: 100,
            toolUseEfficiency: 90,
            latencyP50: 1000,
            totalCost: "0.01",
            runCount: 5,
          },
          config: { id: 1, name: "Agent A", architecture: "react", model: "gpt-4" },
        },
        {
          result: {
            accuracy: 80,
            successRate: 90,
            toolUseEfficiency: 80,
            latencyP50: 500,
            totalCost: "0.005",
            runCount: 10,
          },
          config: { id: 2, name: "Agent B", architecture: "cot", model: "gpt-3.5" },
        },
      ];
      state.selectRows = mockResults;

      const leaderboard = await benchmarkService.getLeaderboard(1, "score");

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].rank).toBe(2);

      // Both should have calculated composite scores
      expect(leaderboard[0].score).toBeGreaterThan(0);
      expect(leaderboard[1].score).toBeGreaterThan(0);
    });

    it("sorts by specific metrics", async () => {
      const mockResults = [
        { result: { accuracy: 80 }, config: { id: 1 } },
        { result: { accuracy: 95 }, config: { id: 2 } },
      ];
      state.updateQueue = [mockResults, mockResults];

      const byAccuracy = await benchmarkService.getLeaderboard(1, "accuracy");
      expect(byAccuracy[0].agentConfig.id).toBe(2); // 95 > 80

      const byLatency = await benchmarkService.getLeaderboard(1, "latency");
      // With missing latencies, they sort as Infinity, but keeping the same order
      expect(byLatency).toHaveLength(2);
    });
  });

  describe("compareAgents", () => {
    it("returns formatted comparison metrics", async () => {
      state.selectRows = [
        {
          result: { accuracy: 90, runCount: 5 },
          config: { id: 1, name: "Agent A", architecture: "react", model: "gpt-4" },
        },
      ];

      const comparison = await benchmarkService.compareAgents(1, [1]);

      expect(comparison).toHaveLength(1);
      expect(comparison[0].agentConfig.name).toBe("Agent A");
      expect(comparison[0].metrics.accuracy).toBe(90);
    });
  });

  describe("getBenchmarkStats", () => {
    it("handles zero participants", async () => {
      state.selectRows = [];
      const stats = await benchmarkService.getBenchmarkStats(1);
      expect(stats.participantCount).toBe(0);
      expect(stats.totalRuns).toBe(0);
    });

    it("calculates aggregate stats across participants", async () => {
      state.updateQueue = [
        [
          // results
          { agentConfigId: 1, runCount: 5, accuracy: 90, latencyP50: 100 },
          { agentConfigId: 2, runCount: 3, accuracy: 80, latencyP50: 200 },
        ],
        [{ name: "Top Agent", architecture: "react" }], // getAgentConfigById
      ];

      const stats = await benchmarkService.getBenchmarkStats(1);

      expect(stats.participantCount).toBe(2);
      expect(stats.totalRuns).toBe(8); // 5 + 3
      expect(stats.avgAccuracy).toBe(85); // (90+80)/2
      expect(stats.avgLatency).toBe(150); // (100+200)/2
      expect(stats.topPerformer?.name).toBe("Top Agent");
    });
  });

  describe("getArchitectureComparison", () => {
    it("aggregates by architecture", async () => {
      state.selectRows = [
        { architecture: "react", avgAccuracy: 85, avgLatency: 150, avgCost: "0.05", count: 10 },
        { architecture: "cot", avgAccuracy: null, avgLatency: null, avgCost: null, count: 5 },
      ];

      const comp = await benchmarkService.getArchitectureComparison(1);

      expect(comp).toHaveLength(2);
      expect(comp[0].architecture).toBe("react");
      expect(comp[0].avgAccuracy).toBe(85);

      // Handles nulls gracefully
      expect(comp[1].architecture).toBe("cot");
      expect(comp[1].avgAccuracy).toBe(0);
    });
  });

  describe("SLAViolation Checking", () => {
    it("returns passed if run not found", async () => {
      state.selectRows = [];
      const result = await checkSLAViolations(999);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("checks latency SLA", async () => {
      state.selectRows = [
        {
          run: { id: 1, totalDurationMs: 2000 },
          workflow: { id: 1, slaLatencyMs: 1000 },
        },
      ];

      const result = await checkSLAViolations(1);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe("latency");
      // 1000ms over 1000ms SLA = 100% overage -> critical
      expect(result.violations[0].severity).toBe("critical");
    });

    it("checks cost SLA", async () => {
      state.selectRows = [
        {
          run: { id: 1, totalCost: "0.15" },
          workflow: { id: 1, slaCostDollars: "0.10" },
        },
      ];

      const result = await checkSLAViolations(1);

      expect(result.passed).toBe(false);
      expect(result.violations[0].type).toBe("cost");
      // 0.15 over 0.10 = 50% overage -> warning
      expect(result.violations[0].severity).toBe("warning");
    });

    it("checks error rate SLA", async () => {
      // First select is the run/workflow
      // Second select is recent runs
      state.updateQueue = [
        [
          {
            run: { id: 1 },
            workflow: { id: 1, slaErrorRate: 5.0 }, // 5% acceptable error rate
          },
        ],
        [
          { status: "failed" },
          { status: "failed" }, // 2 failures out of 10 = 20% error rate
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
        ],
      ];

      const result = await checkSLAViolations(1);

      expect(result.passed).toBe(false);
      const v = result.violations.find((x: any) => x.type === "error_rate");
      expect(v).toBeDefined();
      expect(v.actual).toBe(20);
      // 20% > 5% * 1.5 -> critical
      expect(v.severity).toBe("critical");
    });
  });

  describe("getWorkflowSLAStatus", () => {
    it("throws if workflow not found", async () => {
      state.selectRows = [];
      await expect(getWorkflowSLAStatus(999)).rejects.toThrow("Workflow 999 not found");
    });

    it("calculates compliance rate", async () => {
      // Mock workflow, then recent runs, then checkSLAViolations calls for each run
      state.updateQueue = [
        [{ id: 1, name: "WF1", slaLatencyMs: 1000 }], // workflow
        [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }], // recent runs
        [{ run: { id: 10, totalDurationMs: 500 }, workflow: { slaLatencyMs: 1000 } }], // run 10 passes
        [{ run: { id: 11, totalDurationMs: 1500 }, workflow: { slaLatencyMs: 1000 } }], // run 11 fails
        [{ run: { id: 12, totalDurationMs: 500 }, workflow: { slaLatencyMs: 1000 } }], // run 12 passes
        [{ run: { id: 13, totalDurationMs: 500 }, workflow: { slaLatencyMs: 1000 } }], // run 13 passes
      ];

      const result = await getWorkflowSLAStatus(1);

      expect(result.recentViolations).toBe(1);
      expect(result.complianceRate).toBe(75); // 3/4 passed
    });
  });
});
