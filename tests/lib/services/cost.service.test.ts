import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  updateQueue: [] as unknown[],
  insertCalls: [] as unknown[],
  updateCalls: [] as unknown[],
}));

const makeBuilder = (result: unknown[]) => {
  const builder: Record<string, unknown> = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
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
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((value: unknown) => ({ type: "desc", value })),
  gte: vi.fn((left: unknown, right: unknown) => ({ type: "gte", left, right })),
  lte: vi.fn((left: unknown, right: unknown) => ({ type: "lte", left, right })),
  inArray: vi.fn((col: unknown, arr: unknown[]) => ({ type: "inArray", col, arr })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

describe("CostService", () => {
  let costService: any;

  beforeAll(async () => {
    const mod = await import("@/lib/services/cost.service");
    costService = mod.costService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectRows = [];
    state.updateQueue = [];
    state.insertCalls = [];
    state.updateCalls = [];
    // Clear pricing cache
    costService.pricingCache.clear();
    costService.pricingCacheExpiry = 0;
  });

  describe("getPricing", () => {
    it("returns cached pricing when cache is valid", async () => {
      // Pre-populate cache
      costService.pricingCache.set("openai/gpt-4", { inputPrice: 2.0, outputPrice: 6.0 });
      costService.pricingCacheExpiry = Date.now() + 10000;

      const pricing = await costService.getPricing("openai", "gpt-4");

      expect(pricing).toEqual({ inputPrice: 2.0, outputPrice: 6.0 });
    });

    it("refreshes cache when expired", async () => {
      costService.pricingCacheExpiry = Date.now() - 1000; // Expired
      state.selectRows = [
        {
          provider: "openai",
          model: "gpt-4",
          inputPricePerMillion: "2.0",
          outputPricePerMillion: "6.0",
        },
      ];

      const pricing = await costService.getPricing("openai", "gpt-4");

      expect(pricing).toEqual({ inputPrice: 2.0, outputPrice: 6.0 });
      expect(costService.pricingCache.has("openai/gpt-4")).toBe(true);
    });

    it("returns default pricing when not found", async () => {
      costService.pricingCacheExpiry = Date.now() + 10000; // Valid cache but empty

      const pricing = await costService.getPricing("unknown", "model");

      expect(pricing).toEqual({ inputPrice: 1.0, outputPrice: 3.0 });
    });
  });

  describe("calculateCost", () => {
    it("calculates cost correctly", async () => {
      costService.pricingCache.set("openai/gpt-4", { inputPrice: 2.0, outputPrice: 6.0 });

      const result = await costService.calculateCost("openai", "gpt-4", 1000, 500);

      // Using default pricing (1.0, 3.0) since cache is empty
      // Input: 1000/1M * 1.0 = 0.001
      // Output: 500/1M * 3.0 = 0.0015
      // Total: 0.0025
      expect(result).toEqual({
        inputCost: 0.001,
        outputCost: 0.0015,
        totalCost: 0.0025,
      });
    });
  });

  describe("createRecord", () => {
    it("creates cost record with calculated costs", async () => {
      costService.pricingCache.set("openai/gpt-4", { inputPrice: 2.0, outputPrice: 6.0 });

      const params = {
        spanId: 1,
        organizationId: 1,
        provider: "openai",
        model: "gpt-4",
        inputTokens: 1000,
        outputTokens: 500,
        category: "llm" as const,
      };

      const result = await costService.createRecord(params);

      expect(result).toBeDefined();
      expect(state.insertCalls).toHaveLength(1);
      const inserted = state.insertCalls[0] as any;
      expect(inserted.spanId).toBe(1);
      expect(inserted.provider).toBe("openai");
      expect(inserted.model).toBe("gpt-4");
      expect(inserted.inputTokens).toBe(1000);
      expect(inserted.outputTokens).toBe(500);
      expect(inserted.totalTokens).toBe(1500);
      // Using default pricing (1.0, 3.0)
      // Input: 1000/1M * 1.0 = 0.001
      // Output: 500/1M * 3.0 = 0.0015
      // Total: 0.0025
      expect(inserted.inputCost).toBe("0.00100000");
      expect(inserted.outputCost).toBe("0.00150000");
      expect(inserted.totalCost).toBe("0.00250000");
      expect(inserted.costCategory).toBe("llm");
      expect(inserted.isRetry).toBe(false);
    });

    it("handles retry parameters", async () => {
      costService.pricingCache.set("anthropic/claude", { inputPrice: 3.0, outputPrice: 15.0 });

      const params = {
        spanId: 2,
        organizationId: 1,
        provider: "anthropic",
        model: "claude",
        inputTokens: 2000,
        outputTokens: 1000,
        isRetry: true,
        retryNumber: 2,
      };

      await costService.createRecord(params);

      const inserted = state.insertCalls[0] as any;
      expect(inserted.isRetry).toBe(true);
      expect(inserted.retryNumber).toBe(2);
    });
  });

  describe("getById", () => {
    it("returns record when found", async () => {
      state.selectRows = [{ id: 1, spanId: 1 }];
      const result = await costService.getById(1);
      expect(result?.id).toBe(1);
    });

    it("returns null when not found", async () => {
      state.selectRows = [];
      const result = await costService.getById(999);
      expect(result).toBeNull();
    });
  });

  describe("listByWorkflowRun", () => {
    it("returns records for workflow run", async () => {
      state.selectRows = [
        { id: 1, workflowRunId: 100 },
        { id: 2, workflowRunId: 100 },
      ];

      const results = await costService.listByWorkflowRun(100);

      expect(results).toHaveLength(2);
    });
  });

  describe("aggregateWorkflowCost", () => {
    it("aggregates costs correctly", async () => {
      state.selectRows = [
        {
          id: 1,
          provider: "openai",
          model: "gpt-4",
          totalCost: "0.005",
          totalTokens: 1500,
          inputTokens: 1000,
          outputTokens: 500,
          costCategory: "llm",
          isRetry: false,
        },
        {
          id: 2,
          provider: "anthropic",
          model: "claude",
          totalCost: "0.008",
          totalTokens: 2000,
          inputTokens: 1200,
          outputTokens: 800,
          costCategory: "llm",
          isRetry: true,
        },
      ];

      const breakdown = await costService.aggregateWorkflowCost(100);

      expect(breakdown.totalCost).toBeCloseTo(0.013, 5);
      expect(breakdown.byCategory.llm).toBeCloseTo(0.013, 5);
      expect(breakdown.retryCount).toBe(1);
      expect(breakdown.retryCost).toBe(0.008);
    });

    it("returns empty breakdown for no records", async () => {
      state.selectRows = [];
      const breakdown = await costService.aggregateWorkflowCost(999);

      expect(breakdown.totalCost).toBe(0);
      expect(breakdown.byProvider).toEqual({});
      expect(breakdown.retryCount).toBe(0);
    });
  });

  describe("getCostBreakdownByTrace", () => {
    it("returns breakdown for trace with spans", async () => {
      state.updateQueue = [
        [{ id: 1 }, { id: 2 }], // spans for trace
        [
          // cost records for those spans
          {
            id: 1,
            spanId: 1,
            provider: "openai",
            model: "gpt-4",
            totalCost: "0.005",
            totalTokens: 1500,
            costCategory: "llm",
            isRetry: false,
          },
          {
            id: 2,
            spanId: 2,
            provider: "openai",
            model: "gpt-4",
            totalCost: "0.003",
            totalTokens: 1000,
            costCategory: "tool",
            isRetry: false,
          },
        ],
      ];

      const breakdown = await costService.getCostBreakdownByTrace(1);

      expect(breakdown.totalCost).toBe(0.008);
      expect(breakdown.totalTokens).toBe(2500);
      expect(breakdown.byProvider.openai).toBe(0.008);
      expect(breakdown.byCategory.llm).toBe(0.005);
      expect(breakdown.byCategory.tool).toBe(0.003);
    });

    it("returns empty breakdown for trace with no spans", async () => {
      state.selectRows = []; // no spans
      const breakdown = await costService.getCostBreakdownByTrace(999);

      expect(breakdown.totalCost).toBe(0);
      expect(breakdown.byProvider).toEqual({});
    });
  });

  describe("getCostTrends", () => {
    it("returns aggregated trends by date", async () => {
      state.selectRows = [
        {
          date: "2024-01-01",
          totalCost: "0.100",
          tokenCount: 10000,
          requestCount: 10,
        },
        {
          date: "2024-01-02",
          totalCost: "0.150",
          tokenCount: 15000,
          requestCount: 15,
        },
      ];

      const trends = await costService.getCostTrends(1, "2024-01-01", "2024-01-02");

      expect(trends).toHaveLength(2);
      expect(trends[0]).toEqual({
        date: "2024-01-01",
        totalCost: 0.1,
        tokenCount: 10000,
        requestCount: 10,
      });
    });
  });

  describe("getOrganizationCostSummary", () => {
    it("returns comprehensive cost summary", async () => {
      state.updateQueue = [
        [
          // last30Days query
          {
            totalCost: "1.000",
            totalTokens: 100000,
            requestCount: 100,
          },
        ],
        [
          // last7Days query
          {
            totalCost: "0.300",
            totalTokens: 30000,
            requestCount: 30,
          },
        ],
        [
          // topModels query
          {
            provider: "openai",
            model: "gpt-4",
            totalCost: "0.500",
            requestCount: 50,
          },
          {
            provider: "anthropic",
            model: "claude",
            totalCost: "0.300",
            requestCount: 30,
          },
        ],
      ];

      const summary = await costService.getOrganizationCostSummary(1);

      expect(summary.last30Days.totalCost).toBe(1.0);
      expect(summary.last30Days.totalTokens).toBe(100000);
      expect(summary.last30Days.requestCount).toBe(100);

      expect(summary.last7Days.totalCost).toBe(0.3);
      expect(summary.last7Days.totalTokens).toBe(30000);
      expect(summary.last7Days.requestCount).toBe(30);

      expect(summary.topModels).toHaveLength(2);
      expect(summary.topModels[0]).toEqual({
        provider: "openai",
        model: "gpt-4",
        totalCost: 0.5,
        requestCount: 50,
      });
    });
  });

  describe("getAllPricing", () => {
    it("returns all active pricing", async () => {
      state.selectRows = [
        { provider: "openai", model: "gpt-4", isActive: true },
        { provider: "anthropic", model: "claude", isActive: true },
      ];

      const pricing = await costService.getAllPricing();

      expect(pricing).toHaveLength(2);
    });
  });

  describe("updatePricing", () => {
    it("deactivates old pricing and creates new", async () => {
      state.updateQueue = [
        [], // update query result
        [{ id: 1, provider: "openai", model: "gpt-4" }], // insert result
      ];

      const result = await costService.updatePricing("openai", "gpt-4", "2.50", "7.50");

      expect(result).toBeDefined();
      expect(state.updateCalls).toHaveLength(1);
      expect(state.updateCalls[0]).toEqual({ isActive: false });
      expect(state.insertCalls).toHaveLength(1);

      // Cache should be cleared
      expect(costService.pricingCacheExpiry).toBe(0);
    });
  });
});
