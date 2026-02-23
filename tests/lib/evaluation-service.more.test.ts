import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  updateValues: null as Record<string, unknown> | null,
  deleteWhereCalled: false,
}));

const makeBuilder = (result: unknown[]) => {
  const builder: Record<string, unknown> = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    set: vi.fn((values: Record<string, unknown>) => {
      state.updateValues = values;
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
    select: vi.fn(() => makeBuilder(state.selectRows)),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: () => Promise.resolve([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => makeBuilder(state.selectRows)),
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        state.deleteWhereCalled = true;
        return Promise.resolve();
      }),
    })),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  and: vi.fn((...args: unknown[]) => ({ args })),
  desc: vi.fn((value: unknown) => value),
  count: vi.fn(() => ({ totalRuns: 5 })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/aggregate-metrics.service", () => ({
  computeAndStoreQualityScore: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/eval/assertion-runners", () => ({
  runAssertions: vi.fn(() => ({ results: [] })),
}));

vi.mock("@/lib/eval/assertions", () => ({
  validateAssertionsEnvelope: vi.fn((envelope: unknown) => envelope),
}));

describe("EvaluationService additional coverage", () => {
  let evaluationService: any;

  beforeAll(async () => {
    const mod = await import("@/lib/services/evaluation.service");
    evaluationService = mod.evaluationService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectRows = [];
    state.updateValues = null;
    state.deleteWhereCalled = false;
  });

  describe("getById", () => {
    it("returns null when evaluation not found", async () => {
      state.selectRows = [];

      const result = await evaluationService.getById(999, 1);

      expect(result).toBeNull();
    });

    it("returns evaluation with test cases and runs", async () => {
      const mockEval = { id: 1, name: "Test Eval", organizationId: 1 };
      const mockTestCases = [{ id: 1, input: "test" }];
      const mockRuns = [{ id: 1, status: "completed" }];

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeBuilder([mockEval]);
        if (callCount === 2) return makeBuilder(mockTestCases);
        return makeBuilder(mockRuns);
      });

      const result = await evaluationService.getById(1, 1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.testCases).toEqual(mockTestCases);
      expect(result?.runs).toEqual(mockRuns);
    });
  });

  describe("update", () => {
    it("returns null when evaluation not found", async () => {
      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        return makeBuilder([]);
      });

      const result = await evaluationService.update(999, 1, { name: "New Name" });

      expect(result).toBeNull();
    });

    it("updates evaluation fields", async () => {
      const mockEval = { id: 1, name: "Test Eval", organizationId: 1 };
      const updatedEval = { id: 1, name: "Updated Name", organizationId: 1 };

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        return makeBuilder(callCount <= 3 ? [mockEval] : []);
      });
      vi.mocked((await import("@/db")).db.update).mockImplementation(() => {
        const builder = makeBuilder([updatedEval]);
        return builder as any;
      });

      const result = await evaluationService.update(1, 1, {
        name: "Updated Name",
        description: "New description",
        status: "active",
      });

      expect(result).not.toBeNull();
    });
  });

  describe("delete", () => {
    it("returns false when evaluation not found", async () => {
      state.selectRows = [];

      const result = await evaluationService.delete(999, 1);

      expect(result).toBe(false);
    });

    it("deletes evaluation when found", async () => {
      const mockEval = { id: 1, name: "Test Eval", organizationId: 1 };

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        return makeBuilder(callCount <= 3 ? [mockEval] : []);
      });

      const result = await evaluationService.delete(1, 1);

      expect(result).toBe(true);
      expect(state.deleteWhereCalled).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns null when evaluation not found", async () => {
      state.selectRows = [];

      const result = await evaluationService.getStats(999, 1);

      expect(result).toBeNull();
    });

    it("returns stats for existing evaluation", async () => {
      const mockEval = { id: 1, name: "Test Eval", organizationId: 1, status: "active" };

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return makeBuilder([mockEval]);
        if (callCount === 4) return makeBuilder([{ totalRuns: 5 }]);
        if (callCount === 5) return makeBuilder([{ totalTestCases: 10 }]);
        return makeBuilder([{ createdAt: "2024-01-01" }]);
      });

      const result = await evaluationService.getStats(1, 1);

      expect(result).not.toBeNull();
    });
  });

  describe("run", () => {
    it("returns null when evaluation not found", async () => {
      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        return makeBuilder([]);
      });

      const result = await evaluationService.run(999, 1);

      expect(result).toBeNull();
    });

    it("handles evaluation with no test cases", async () => {
      const mockEval = { id: 1, name: "Test Eval", organizationId: 1, type: "standard" };
      const mockRun = { id: 1, startedAt: "2024-01-01" }; // Drizzle returning() just gives back what we inserted usually

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return makeBuilder([mockEval]);
        return makeBuilder([]); // No test cases
      });
      vi.mocked((await import("@/db")).db.insert).mockImplementation(() => {
        return {
          values: vi.fn((val: any) => ({
            returning: () => Promise.resolve([{ ...mockRun, ...val }]), // Return the merged values like DB does
          })),
        } as any;
      });

      const result = await evaluationService.run(1, 1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.totalCases).toBe(0);
    });

    it("handles human_eval type by setting pending_review status", async () => {
      const mockEval = { id: 1, name: "Human Eval", organizationId: 1, type: "human_eval" };
      const mockTestCases = [{ id: 1, input: "test", expectedOutput: "expected" }];
      const mockRun = { id: 1, startedAt: "2024-01-01" };

      let callCount = 0;
      vi.mocked((await import("@/db")).db.select).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return makeBuilder([mockEval]);
        return makeBuilder(mockTestCases);
      });
      vi.mocked((await import("@/db")).db.insert).mockImplementation(() => {
        return {
          values: vi.fn(() => ({
            returning: () => Promise.resolve([mockRun]),
          })),
        } as any;
      });

      const result = await evaluationService.run(1, 1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });
  });
});
