import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  selectCallCount: 0,
}));

const makeBuilder = (getResult: () => unknown[]) => {
  const builder: Record<string, unknown> = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    // biome-ignore lint/suspicious/noThenProperty: test mock
    then: (onFulfilled: (value: unknown) => unknown) => {
      return Promise.resolve(getResult()).then(onFulfilled);
    },
  };
  return builder;
};

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      state.selectCallCount++;
      return makeBuilder(() => state.selectRows);
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  desc: vi.fn((value: unknown) => value),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

describe("qualityService", () => {
  let qualityService: any;

  beforeAll(async () => {
    const mod = await import("@/lib/services/quality.service");
    qualityService = mod.qualityService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectRows = [];
    state.selectCallCount = 0;
  });

  describe("latest", () => {
    it("returns null when evaluation not found", async () => {
      state.selectRows = [];

      const result = await qualityService.latest(1, 999);

      expect(result).toBeNull();
    });

    it("returns message when no quality scores exist", async () => {
      // First call returns evaluation, second returns empty quality scores
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return makeBuilder(() => [{ id: 1, organizationId: 1, publishedRunId: null }]);
        }
        return makeBuilder(() => []);
      });

      const result = await qualityService.latest(1, 1);

      expect(result).toEqual({ score: null, message: "No quality scores computed yet" });
    });

    it("returns latest quality score with regression detection", async () => {
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          // Evaluation with published run
          return makeBuilder(() => [{ id: 1, organizationId: 1, publishedRunId: 100 }]);
        }
        if (callNum === 2) {
          // Latest quality score
          return makeBuilder(() => [
            {
              id: 1,
              evaluationRunId: 200,
              evaluationId: 1,
              organizationId: 1,
              score: 75,
              total: 100,
              traceCoverageRate: "0.9",
              provenanceCoverageRate: "0.85",
              breakdown: {},
              flags: [],
              evidenceLevel: "high",
              scoringVersion: "1.0",
              model: "gpt-4",
              createdAt: "2024-01-01",
            },
          ]);
        }
        if (callNum === 3) {
          // Baseline quality score
          return makeBuilder(() => [{ score: 85 }]);
        }
        return makeBuilder(() => []);
      });

      const result = await qualityService.latest(1, 1, { baseline: "published" });

      expect(result).not.toBeNull();
      expect((result as any).score).toBe(75);
      expect((result as any).baselineScore).toBe(85);
      expect((result as any).regressionDelta).toBe(-10);
      expect((result as any).regressionDetected).toBe(true);
    });

    it("detects no regression when delta is positive", async () => {
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return makeBuilder(() => [{ id: 1, organizationId: 1, publishedRunId: 100 }]);
        }
        if (callNum === 2) {
          return makeBuilder(() => [
            {
              id: 1,
              evaluationRunId: 200,
              evaluationId: 1,
              organizationId: 1,
              score: 90,
              scoringVersion: "1.0",
              createdAt: "2024-01-01",
            },
          ]);
        }
        if (callNum === 3) {
          return makeBuilder(() => [{ score: 85 }]);
        }
        return makeBuilder(() => []);
      });

      const result = await qualityService.latest(1, 1, { baseline: "published" });

      expect((result as any).regressionDelta).toBe(5);
      expect((result as any).regressionDetected).toBe(false);
    });
  });

  describe("trend", () => {
    it("returns null when evaluation not found", async () => {
      state.selectRows = [];

      const result = await qualityService.trend(1, 999);

      expect(result).toBeNull();
    });

    it("returns trend data with count", async () => {
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return makeBuilder(() => [{ id: 1, organizationId: 1 }]);
        }
        return makeBuilder(() => [
          { id: 1, score: 80, createdAt: "2024-01-01" },
          { id: 2, score: 85, createdAt: "2024-01-02" },
          { id: 3, score: 82, createdAt: "2024-01-03" },
        ]);
      });

      const result = await qualityService.trend(1, 1);

      expect(result).not.toBeNull();
      expect(result?.count).toBe(3);
      expect(result?.data).toHaveLength(3);
      // Data should be reversed (oldest first)
      expect(result?.data[0].score).toBe(82);
    });

    it("respects limit option", async () => {
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return makeBuilder(() => [{ id: 1, organizationId: 1 }]);
        }
        return makeBuilder(() => [{ id: 1, score: 80 }]);
      });

      const result = await qualityService.trend(1, 1, { limit: 5 });

      expect(result).not.toBeNull();
    });

    it("caps limit at 100", async () => {
      let callNum = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callNum++;
        if (callNum === 1) {
          return makeBuilder(() => [{ id: 1, organizationId: 1 }]);
        }
        return makeBuilder(() => []);
      });

      const result = await qualityService.trend(1, 1, { limit: 500 });

      expect(result).not.toBeNull();
      expect(result?.count).toBe(0);
    });
  });
});
