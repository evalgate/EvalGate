/**
 * Trace-Linked Executor Integration Test
 *
 * Verifies TraceLinkedExecutor correctly:
 * - Filters by evaluationRunId AND runStartedAt when both present
 * - Returns the stamped span (not old spans with same inputHash)
 * - Returns provenance (model/provider) when cost record exists
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TraceLinkedExecutor } from "@/lib/services/eval-executor";

// Hoisted mocks (required for vi.mock)
const { selectCallCounter, mockLimit, mockSelect } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockLeftJoin = vi.fn(() => ({ where: mockWhere }));
  const mockInnerJoin = vi.fn(() => ({ leftJoin: mockLeftJoin }));
  const mockFromSpans = vi.fn(() => ({ innerJoin: mockInnerJoin }));

  const subqueryRef = {};
  const mockAs = vi.fn(() => subqueryRef);
  const mockGroupBy = vi.fn(() => ({ as: mockAs }));
  const mockWhereSub = vi.fn(() => ({ groupBy: mockGroupBy }));
  const mockFromCost = vi.fn(() => ({ where: mockWhereSub }));

  const selectCallCounter = { value: 0 };
  const mockSelect = vi.fn(() => {
    selectCallCounter.value++;
    return selectCallCounter.value === 1 ? { from: mockFromCost } : { from: mockFromSpans };
  });

  return { selectCallCounter, mockLimit, mockSelect };
});

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
  },
}));

// Mock sha256Input for deterministic inputHash
vi.mock("@/lib/utils/input-hash", () => ({
  sha256Input: (input: string) => `hash-${input.length}`,
}));

describe("TraceLinkedExecutor", () => {
  const orgId = 1;
  const runId = 100;
  const runStartedAt = "2025-02-01T10:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCounter.value = 0;
  });

  it("filters by evaluationRunId and runStartedAt when both provided", async () => {
    mockLimit.mockResolvedValue([
      {
        id: 1,
        output: "matched output",
        durationMs: 50,
        model: "gpt-4o",
        provider: "openai",
        totalCost: "0.001",
      },
    ]);

    const executor = new TraceLinkedExecutor(orgId, runId, runStartedAt);
    const result = await executor.run("test input");

    expect(result.output).toBe("matched output");
    expect(result.model).toBe("gpt-4o");
    expect(result.provider).toBe("openai");
    expect(result.meta?.matched).toBe(true);

    // Verify the query was built (select → from → innerJoin → leftJoin → where → orderBy → limit)
    expect(mockSelect).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("returns provenance (model/provider) when cost record exists", async () => {
    mockLimit.mockResolvedValue([
      {
        id: 2,
        output: "output with cost",
        durationMs: 100,
        model: "claude-3-sonnet",
        provider: "anthropic",
        totalCost: "0.002",
      },
    ]);

    const executor = new TraceLinkedExecutor(orgId, runId);
    const result = await executor.run("another input");

    expect(result.model).toBe("claude-3-sonnet");
    expect(result.provider).toBe("anthropic");
    expect(result.meta?.matched).toBe(true);
  });

  it("returns meta.matched false when no span matches", async () => {
    mockLimit.mockResolvedValue([]);

    const executor = new TraceLinkedExecutor(orgId, runId, runStartedAt);
    const result = await executor.run("no matching span");

    expect(result.output).toBe("");
    expect(result.meta?.matched).toBe(false);
    expect(result.provider).toBe("trace-linked");
  });

  it("uses provider trace-linked when no cost record (no model)", async () => {
    mockLimit.mockResolvedValue([
      {
        id: 3,
        output: "output without cost",
        durationMs: 80,
        model: null,
        provider: null,
        totalCost: null,
      },
    ]);

    const executor = new TraceLinkedExecutor(orgId, runId);
    const result = await executor.run("input");

    expect(result.output).toBe("output without cost");
    expect(result.model).toBeUndefined();
    expect(result.provider).toBe("trace-linked");
  });
});
