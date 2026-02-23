import { beforeEach, describe, expect, it, vi } from "vitest";
import { costService } from "@/lib/services/cost.service";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
  },
}));

describe("Cost Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getById", () => {
    it("should return null when cost record not found", async () => {
      const result = await costService.getById(999);
      expect(result).toBeNull();
    });

    it("should return cost record when found", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                spanId: 123,
                organizationId: 1,
                provider: "openai",
                model: "gpt-4",
                inputTokens: 100,
                outputTokens: 50,
                totalCost: 0.015,
                category: "llm",
                isRetry: false,
                createdAt: "2024-01-01T00:00:00Z",
              },
            ]),
          }),
        }),
      } as any);

      const result = await costService.getById(1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.provider).toBe("openai");
      expect(result?.model).toBe("gpt-4");
    });
  });

  describe("listByWorkflowRun", () => {
    it("should return empty list when no records found", async () => {
      const result = await costService.listByWorkflowRun(999);
      expect(result).toEqual([]);
    });

    it("should return cost records for workflow run", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([
                {
                  id: 1,
                  spanId: 123,
                  workflowRunId: 456,
                  organizationId: 1,
                  provider: "openai",
                  model: "gpt-4",
                  inputTokens: 100,
                  outputTokens: 50,
                  totalCost: 0.015,
                  category: "llm",
                  isRetry: false,
                  createdAt: "2024-01-01T00:00:00Z",
                },
              ]),
            }),
          }),
        }),
      } as any);

      const result = await costService.listByWorkflowRun(456);
      expect(result).toHaveLength(1);
      expect(result[0].workflowRunId).toBe(456);
    });

    it("should respect limit parameter", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([]),
            }),
          }),
        }),
      } as any);

      await costService.listByWorkflowRun(456, 50);

      // Verify the mock was called
      expect(mockDb.db.select).toHaveBeenCalled();
    });
  });
});
