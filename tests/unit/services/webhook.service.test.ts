import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateWebhookInput } from "@/lib/services/webhook.service";
import { webhookService } from "@/lib/services/webhook.service";

// Mock external dependencies
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
  },
}));

vi.mock("@/lib/jobs/enqueue", () => ({
  enqueue: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/security/webhook-secrets", () => ({
  encryptWebhookSecret: vi.fn((secret: string) => `encrypted_${secret}`),
  decryptWebhookSecret: vi.fn((secret: string) => secret.replace("encrypted_", "")),
}));

describe("Webhook Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return empty list when no webhooks found", async () => {
      const result = await webhookService.list(1);
      expect(result).toEqual([]);
    });

    it("should return webhooks for organization", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                organizationId: 1,
                url: "https://example.com/webhook",
                events: ["evaluation.created"],
                description: "Test webhook",
                status: "active",
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-01T00:00:00Z",
              },
            ]),
          }),
        }),
      } as any);

      const result = await webhookService.list(1);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/webhook");
      expect(result[0].events).toEqual(["evaluation.created"]);
    });
  });

  describe("getById", () => {
    it("should return null when webhook not found", async () => {
      const result = await webhookService.getById(999, 1);
      expect(result).toBeNull();
    });

    it("should return webhook when found", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                organizationId: 1,
                url: "https://example.com/webhook",
                events: ["evaluation.created"],
                description: "Test webhook",
                status: "active",
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-01T00:00:00Z",
              },
            ]),
          }),
        }),
      } as any);

      const result = await webhookService.getById(1, 1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.url).toBe("https://example.com/webhook");
    });
  });

  describe("create", () => {
    it("should create a webhook successfully", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 123,
              organizationId: 1,
              url: "https://example.com/webhook",
              events: ["evaluation.created"],
              description: "Test webhook",
              status: "active",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ]),
        }),
      } as any);

      const data: CreateWebhookInput = {
        url: "https://example.com/webhook",
        events: ["evaluation.created"],
        description: "Test webhook",
        secret: "test-secret",
      };

      const result = await webhookService.create(1, data);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(123);
      expect(result?.url).toBe("https://example.com/webhook");
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it("should create webhook without secret", async () => {
      const mockDb = await import("@/db");

      vi.mocked(mockDb.db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 124,
              organizationId: 1,
              url: "https://example.com/webhook-2",
              events: ["evaluation.completed"],
              description: "Test webhook 2",
              status: "active",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ]),
        }),
      } as any);

      const data: CreateWebhookInput = {
        url: "https://example.com/webhook-2",
        events: ["evaluation.completed"],
        description: "Test webhook 2",
      };

      const result = await webhookService.create(1, data);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(124);
    });
  });

  describe("delete", () => {
    it("should delete a webhook successfully", async () => {
      const mockDb = await import("@/db");

      // Mock getById to return existing webhook
      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                organizationId: 1,
                url: "https://example.com/webhook",
                events: ["evaluation.created"],
                description: "Test webhook",
                status: "active",
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-01T00:00:00Z",
              },
            ]),
          }),
        }),
      } as any);

      vi.mocked(mockDb.db.delete).mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              organizationId: 1,
              url: "https://example.com/webhook",
              events: ["evaluation.created"],
              description: "Test webhook",
              status: "active",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ]),
        }),
      } as any);

      const result = await webhookService.delete(1, 1);
      expect(result).toBe(true);
      expect(mockDb.db.delete).toHaveBeenCalled();
    });

    it("should return false when webhook not found for deletion", async () => {
      const mockDb = await import("@/db");

      // Mock getById to return null (webhook not found)
      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any);

      const result = await webhookService.delete(999, 1);
      expect(result).toBe(false);
    });
  });

  describe("trigger", () => {
    it("should trigger webhook successfully", async () => {
      const mockDb = await import("@/db");

      // Mock webhook lookup - return array for activeWebhooks
      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              organizationId: 1,
              url: "https://example.com/webhook",
              events: ["evaluation.created"],
              description: "Test webhook",
              status: "active",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ]),
        }),
      } as any);

      const { enqueue } = await import("@/lib/jobs/enqueue");
      vi.mocked(enqueue).mockResolvedValueOnce(123);

      const result = await webhookService.trigger(1, "evaluation.created", { test: "data" });
      expect(result).toEqual({ enqueued: 1 });
      expect(enqueue).toHaveBeenCalled();
    });

    it("should skip webhook when event not subscribed", async () => {
      const mockDb = await import("@/db");

      // Mock webhook lookup with different events
      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              organizationId: 1,
              url: "https://example.com/webhook",
              events: ["evaluation.completed"], // Different event
              description: "Test webhook",
              status: "active",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ]),
        }),
      } as any);

      const result = await webhookService.trigger(1, "evaluation.created", { test: "data" });
      expect(result).toEqual({ enqueued: 0 });
    });

    it("should handle no active webhooks", async () => {
      const mockDb = await import("@/db");

      // Mock empty webhook lookup
      vi.mocked(mockDb.db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      } as any);

      const result = await webhookService.trigger(1, "evaluation.created", { test: "data" });
      expect(result).toEqual({ enqueued: 0 });
    });
  });
});
