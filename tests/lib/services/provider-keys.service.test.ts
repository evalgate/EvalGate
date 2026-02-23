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
    set: vi.fn((values: Record<string, unknown>) => {
      state.updateCalls.push(values);
      return builder;
    }),
    returning: vi.fn(() => Promise.resolve(result)),
    // biome-ignore lint/suspicious/noThenProperty: test mock
    then: (onFulfilled: (value: unknown) => unknown) => {
      // For select queries that use destructuring, ensure we always return an array
      // If result is already an array, use it as-is, otherwise wrap it
      const finalResult = Array.isArray(result) ? result : [result];
      return Promise.resolve(finalResult).then(onFulfilled);
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
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/security/encryption", () => ({
  encryption: {
    encrypt: vi.fn((key: string, salt: string) => ({
      encrypted: `encrypted_${key}_${salt}`,
      iv: "mock_iv",
      tag: "mock_tag",
    })),
    decrypt: vi.fn((encrypted: { encrypted: string; iv: string; tag: string }, salt: string) => ({
      success: true,
      decrypted: "sk-1234567890abcdef1234567890abcdef12345678",
    })),
    deriveKey: vi.fn(
      (baseKey: string, salt: string, iterations: number) => `derived_key_${baseKey}_${salt}`,
    ),
  },
}));

describe("ProviderKeysService", () => {
  let providerKeysService: any;

  beforeAll(async () => {
    const mod = await import("@/lib/services/provider-keys.service");
    providerKeysService = mod.providerKeysService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectRows = [];
    state.updateQueue = [];
    state.insertCalls = [];
    state.updateCalls = [];
    state.deleteWhereCalled = false;
    // Set encryption key for tests
    process.env.PROVIDER_KEY_ENCRYPTION_KEY = "test_encryption_key";
  });

  describe("createProviderKey", () => {
    it("creates provider key successfully", async () => {
      state.updateQueue = [
        { id: 1, name: "Test Org" }, // organization check
      ];

      const result = await providerKeysService.createProviderKey(
        1,
        {
          provider: "openai",
          keyName: "Test Key",
          keyType: "api_key",
          apiKey: "sk-1234567890abcdef1234567890abcdef12345678",
          metadata: { version: "1.0" },
        },
        "user1",
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.provider).toBe("openai");
      expect(result.keyName).toBe("Test Key");
      expect(result.keyType).toBe("api_key");
      expect(result.keyPrefix).toBe("sk-1...");

      expect(state.insertCalls).toHaveLength(1);
      const inserted = state.insertCalls[0] as any;
      expect(inserted.organizationId).toBe(1);
      expect(inserted.provider).toBe("openai");
      expect(inserted.keyName).toBe("Test Key");
      expect(inserted.encryptedKey).toBe(
        "encrypted_sk-1234567890abcdef1234567890abcdef12345678_derived_key_test_encryption_key_org-1",
      );
    });

    it("throws error when organization not found", async () => {
      state.updateQueue = [[]]; // organization check fails

      await expect(
        providerKeysService.createProviderKey(
          999,
          {
            provider: "openai",
            keyName: "Test Key",
            keyType: "api_key",
            apiKey: "sk-1234567890abcdef1234567890abcdef12345678",
          },
          "user1",
        ),
      ).rejects.toThrow("Organization not found");
    });

    it("handles missing metadata", async () => {
      state.updateQueue = [{ id: 1, name: "Test Org" }];

      const result = await providerKeysService.createProviderKey(
        1,
        {
          provider: "anthropic",
          keyName: "Test Key",
          keyType: "api_key",
          apiKey: "sk-ant-test",
        },
        "user1",
      );

      expect(result).toBeDefined();
      const inserted = state.insertCalls[0] as any;
      expect(inserted.metadata).toBe("{}");
    });

    it("throws error without encryption key", async () => {
      const prev = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
      delete process.env.PROVIDER_KEY_ENCRYPTION_KEY;

      state.updateQueue = [{ id: 1, name: "Test Org" }];

      await expect(
        providerKeysService.createProviderKey(
          1,
          {
            provider: "openai",
            keyName: "Test Key",
            keyType: "api_key",
            apiKey: "sk-1234567890abcdef1234567890abcdef12345678",
          },
          "user1",
        ),
      ).rejects.toThrow("PROVIDER_KEY_ENCRYPTION_KEY environment variable is required");

      if (prev !== undefined) process.env.PROVIDER_KEY_ENCRYPTION_KEY = prev;
    });
  });

  describe("listProviderKeys", () => {
    it("returns active keys by default", async () => {
      state.selectRows = [
        {
          id: 1,
          provider: "openai",
          keyName: "Key 1",
          keyType: "api_key",
          keyPrefix: "sk-12...",
          isActive: true,
          lastUsedAt: "2024-01-01",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
        {
          id: 2,
          provider: "anthropic",
          keyName: "Key 2",
          keyType: "api_key",
          keyPrefix: "sk-ant...",
          isActive: true,
          lastUsedAt: null,
          createdAt: "2024-01-02",
          updatedAt: "2024-01-02",
        },
      ];

      const results = await providerKeysService.listProviderKeys(1);

      expect(results).toHaveLength(2);
      expect(results[0].provider).toBe("openai");
      expect(results[0].isActive).toBe(true);
      expect(results[1].provider).toBe("anthropic");
    });

    it("filters by provider", async () => {
      state.selectRows = [
        {
          id: 1,
          provider: "openai",
          keyName: "Key 1",
          keyType: "api_key",
          keyPrefix: "sk-12...",
          isActive: true,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];

      const results = await providerKeysService.listProviderKeys(1, { provider: "openai" });

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe("openai");
    });

    it("includes inactive keys when requested", async () => {
      state.selectRows = [
        {
          id: 1,
          provider: "openai",
          keyName: "Key 1",
          keyType: "api_key",
          keyPrefix: "sk-12...",
          isActive: false,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
        {
          id: 2,
          provider: "anthropic",
          keyName: "Key 2",
          keyType: "api_key",
          keyPrefix: "sk-ant...",
          isActive: true,
          createdAt: "2024-01-02",
          updatedAt: "2024-01-02",
        },
      ];

      const results = await providerKeysService.listProviderKeys(1, { includeInactive: true });

      expect(results).toHaveLength(2);
      expect(results[0].isActive).toBe(false);
      expect(results[1].isActive).toBe(true);
    });
  });

  describe("getProviderKey", () => {
    it("returns decrypted key when found", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          provider: "openai",
          keyName: "Test Key",
          encryptedKey: "encrypted_test",
          iv: "test_iv",
          tag: "test_tag",
          metadata: '{"version": "1.0"}',
          isActive: true,
          lastUsedAt: null,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];

      const result = await providerKeysService.getProviderKey(1, 1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.provider).toBe("openai");
      expect(result.keyName).toBe("Test Key");
      expect(result.decryptedKey).toBe("sk-1234567890abcdef1234567890abcdef12345678");
      expect(result.metadata.version).toBe("1.0");
      expect(result.isActive).toBe(true);

      // Should update lastUsedAt
      expect(state.updateCalls).toHaveLength(1);
      expect(state.updateCalls[0]).toEqual({ lastUsedAt: expect.any(String) });
    });

    it("returns null when key not found", async () => {
      state.selectRows = [];
      const result = await providerKeysService.getProviderKey(1, 999);
      expect(result).toBeNull();
    });

    it("throws error when encryption key not found", async () => {
      // Mock getEncryptionKey to return null
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          provider: "openai",
          encryptedKey: "encrypted_test",
          iv: "test_iv",
          tag: "test_tag",
        },
      ];

      // Clear encryption key env var to force error
      delete process.env.PROVIDER_KEY_ENCRYPTION_KEY;

      await expect(providerKeysService.getProviderKey(1, 1)).rejects.toThrow(
        "Encryption key not found for organization",
      );
    });

    it("throws error when decryption fails", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          provider: "openai",
          encryptedKey: "encrypted_test",
          iv: "test_iv",
          tag: "test_tag",
        },
      ];

      // Mock decryption to fail
      const { encryption } = await import("@/lib/security/encryption");
      vi.spyOn(encryption, "decrypt").mockReturnValueOnce({
        success: false,
        error: "Invalid decryption",
      });

      await expect(providerKeysService.getProviderKey(1, 1)).rejects.toThrow(
        "Failed to decrypt provider key: Invalid decryption",
      );
    });
  });

  describe("getActiveProviderKey", () => {
    it("returns active key for provider", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          provider: "openai",
          keyName: "Test Key",
          encryptedKey: "encrypted_test",
          iv: "test_iv",
          tag: "test_tag",
          isActive: true,
        },
      ];

      // Mock getProviderKey to return decrypted key
      const mockGetProviderKey = vi.fn().mockResolvedValueOnce({
        id: 1,
        decryptedKey: "sk-test",
        provider: "openai",
      } as any);
      providerKeysService.getProviderKey = mockGetProviderKey;

      const result = await providerKeysService.getActiveProviderKey(1, "openai");

      expect(result).toBeDefined();
      expect(result.decryptedKey).toBe("sk-test");
      expect(mockGetProviderKey).toHaveBeenCalledWith(1, 1);
    });

    it("returns null when no active key found", async () => {
      state.selectRows = [];
      const result = await providerKeysService.getActiveProviderKey(1, "unknown");
      expect(result).toBeNull();
    });
  });

  describe("updateProviderKey", () => {
    it("updates key name and metadata", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          keyName: "Old Name",
          metadata: '{"old": "data"}',
          isActive: true,
          updatedAt: "2024-01-01",
        },
        {
          id: 1,
          keyName: "New Name",
          metadata: '{"new": "data"}',
          isActive: true,
          updatedAt: "2024-01-02",
        },
      ];

      const result = await providerKeysService.updateProviderKey(1, 1, {
        keyName: "New Name",
        metadata: { new: "data" },
      });

      expect(result.id).toBe(1);
      expect(result.keyName).toBe("New Name");
      expect(result.metadata.new).toBe("data");
      expect(result.isActive).toBe(true);

      expect(state.updateCalls).toHaveLength(1);
      expect(state.updateCalls[0].keyName).toBe("New Name");
      expect(state.updateCalls[0].metadata).toBe('{"new":"data"}');
    });

    it("updates active status", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          keyName: "Test Key",
          isActive: true,
          updatedAt: "2024-01-01",
        },
        {
          id: 1,
          keyName: "Test Key",
          isActive: false,
          updatedAt: "2024-01-02",
        },
      ];

      const result = await providerKeysService.updateProviderKey(1, 1, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it("throws error when key not found", async () => {
      state.updateQueue = [[]];

      await expect(
        providerKeysService.updateProviderKey(1, 999, { keyName: "New Name" }),
      ).rejects.toThrow("Provider key not found");
    });
  });

  describe("deleteProviderKey", () => {
    it("deletes key when found", async () => {
      state.updateQueue = [
        {
          id: 1,
          organizationId: 1,
          keyName: "Test Key",
        },
      ];

      await providerKeysService.deleteProviderKey(1, 1);

      expect(state.deleteWhereCalled).toBe(true);
    });

    it("throws error when key not found", async () => {
      state.updateQueue = [[]];

      await expect(providerKeysService.deleteProviderKey(1, 999)).rejects.toThrow(
        "Provider key not found",
      );
    });
  });

  describe("validateProviderKey", () => {
    it("validates OpenAI key format", () => {
      const validKey = "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      expect(providerKeysService.validateProviderKey("openai", validKey)).toBe(true);
    });

    it("validates Anthropic key format", () => {
      const validKey =
        "sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      expect(providerKeysService.validateProviderKey("anthropic", validKey)).toBe(true);
    });

    it("validates Google key format", () => {
      const validKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      expect(providerKeysService.validateProviderKey("google", validKey)).toBe(true);
    });

    it("rejects invalid OpenAI key", () => {
      const invalidKey = "invalid-key";
      expect(providerKeysService.validateProviderKey("openai", invalidKey)).toBe(false);
    });

    it("accepts unknown providers with basic length check", () => {
      const validKey = "1234567890123456789012345678901234567890";
      expect(providerKeysService.validateProviderKey("unknown", validKey)).toBe(true);
    });

    it("rejects unknown providers with short key", () => {
      const shortKey = "short";
      expect(providerKeysService.validateProviderKey("unknown", shortKey)).toBe(false);
    });
  });

  describe("getProviderKeyStats", () => {
    it("returns statistics correctly", async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentDate = new Date(oneWeekAgo.getTime() + 24 * 60 * 60 * 1000); // 6 days ago
      state.selectRows = [
        {
          provider: "openai",
          isActive: true,
          lastUsedAt: recentDate.toISOString(),
        },
        {
          provider: "openai",
          isActive: false,
          lastUsedAt: null,
        },
        {
          provider: "anthropic",
          isActive: true,
          lastUsedAt: "2024-01-02",
        },
        {
          provider: "google",
          isActive: true,
          lastUsedAt: recentDate.toISOString(),
        },
      ];

      const stats = await providerKeysService.getProviderKeyStats(1);

      expect(stats.totalKeys).toBe(4);
      expect(stats.activeKeys).toBe(3);
      expect(stats.keysByProvider.openai).toBe(2);
      expect(stats.keysByProvider.anthropic).toBe(1);
      expect(stats.keysByProvider.google).toBe(1);
      expect(stats.recentlyUsed).toBe(2); // openai and google (within last week)
    });

    it("returns zero stats for no keys", async () => {
      state.selectRows = [];
      const stats = await providerKeysService.getProviderKeyStats(1);

      expect(stats.totalKeys).toBe(0);
      expect(stats.activeKeys).toBe(0);
      expect(stats.keysByProvider).toEqual({});
      expect(stats.recentlyUsed).toBe(0);
    });
  });
});
