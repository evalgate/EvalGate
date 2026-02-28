import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Redis at the top level before any imports
// Singleton ensures test's fromEnv() and code's getRedis() share the same mock fns
const mockRedisInstance = {
	get: vi.fn(),
	setex: vi.fn(),
	del: vi.fn(),
	keys: vi.fn(),
};

vi.mock("@upstash/redis", () => ({
	Redis: {
		fromEnv() {
			return mockRedisInstance;
		},
	},
}));

describe("redis-cache", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.resetAllMocks();

		// Set up valid Redis environment
		process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
		process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
	});

	describe("configured happy path", () => {
		it("gets and sets values successfully", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockGet = vi.mocked(Redis.fromEnv()).get;
			const mockSetex = vi.mocked(Redis.fromEnv()).setex;

			mockGet.mockResolvedValue({ data: "test" });
			mockSetex.mockResolvedValue("OK");

			const { cache } = await import("@/lib/redis-cache");

			// Test set
			const setResult = await cache.set("test-key", { data: "test" }, 300);
			expect(setResult).toBe(true);
			expect(mockSetex).toHaveBeenCalledWith("cache:test-key", 300, {
				data: "test",
			});

			// Test get
			const getResult = await cache.get("test-key");
			expect(getResult).toEqual({ data: "test" });
			expect(mockGet).toHaveBeenCalledWith("cache:test-key");
		});

		it("handles cache misses correctly", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockGet = vi.mocked(Redis.fromEnv()).get;
			mockGet.mockResolvedValue(null);

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.get("non-existent-key");
			expect(result).toBeNull();
			expect(mockGet).toHaveBeenCalledWith("cache:non-existent-key");
		});

		it("deletes values successfully", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockDel = vi.mocked(Redis.fromEnv()).del;
			mockDel.mockResolvedValue(1);

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.delete("test-key");
			expect(result).toBe(true);
			expect(mockDel).toHaveBeenCalledWith("cache:test-key");
		});

		it("wraps functions with caching", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockGet = vi.mocked(Redis.fromEnv()).get;
			const mockSetex = vi.mocked(Redis.fromEnv()).setex;
			const mockFn = vi.fn().mockResolvedValue("computed-value");

			mockGet.mockResolvedValue(null); // Cache miss first
			mockSetex.mockResolvedValue("OK");

			const { cache } = await import("@/lib/redis-cache");

			// First call - cache miss, should execute function
			const result1 = await cache.wrap("test-key", mockFn, { ttl: 300 });
			expect(result1).toBe("computed-value");
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockSetex).toHaveBeenCalledWith(
				"cache:test-key",
				300,
				"computed-value",
			);

			// Second call with same mock setup - cache miss again due to vi.resetModules()
			const result2 = await cache.wrap("test-key", mockFn, { ttl: 300 });
			expect(result2).toBe("computed-value");
			expect(mockFn).toHaveBeenCalledTimes(2); // Called again due to reset
		});

		it("skips cache when skipCache option is true", async () => {
			const mockFn = vi.fn().mockResolvedValue("fresh-value");

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.wrap("test-key", mockFn, { skipCache: true });
			expect(result).toBe("fresh-value");
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("generates query keys correctly", async () => {
			const { cache } = await import("@/lib/redis-cache");

			const key = cache.generateQueryKey("users", 123, {
				status: "active",
				limit: 10,
				sort: "name",
			});

			expect(key).toBe("users:org:123:limit=10&sort=name&status=active");
		});

		it("handles pattern deletion", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			const mockDel = vi.mocked(Redis.fromEnv()).del;

			mockKeys
				.mockResolvedValueOnce(["cache:test:1", "cache:test:2"])
				.mockResolvedValueOnce([]);
			mockDel.mockResolvedValue(2);

			const { cache } = await import("@/lib/redis-cache");

			const deletedCount = await cache.deletePattern("test:*");
			expect(deletedCount).toBe(2);
			expect(mockKeys).toHaveBeenCalledWith("cache:test:*");
			expect(mockDel).toHaveBeenCalledWith("cache:test:1", "cache:test:2");

			// Test empty pattern
			const emptyCount = await cache.deletePattern("empty:*");
			expect(emptyCount).toBe(0);
		});

		it("gets cache stats", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			mockKeys.mockResolvedValue(["cache:a", "cache:b", "cache:c"]);

			const { cache } = await import("@/lib/redis-cache");

			const stats = await cache.getStats();
			expect(stats).toEqual({ keys: 3 });
			expect(mockKeys).toHaveBeenCalledWith("cache:*");
		});
	});

	describe("error path returns null / doesn't throw", () => {
		it("returns null when get throws error", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockGet = vi.mocked(Redis.fromEnv()).get;
			mockGet.mockRejectedValue(new Error("Redis connection failed"));

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.get("test-key");
			expect(result).toBeNull();
		});

		it("returns false when set throws error", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockSetex = vi.mocked(Redis.fromEnv()).setex;
			mockSetex.mockRejectedValue(new Error("Redis write failed"));

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.set("test-key", "value");
			expect(result).toBe(false);
		});

		it("returns false when delete throws error", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockDel = vi.mocked(Redis.fromEnv()).del;
			mockDel.mockRejectedValue(new Error("Redis delete failed"));

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.delete("test-key");
			expect(result).toBe(false);
		});

		it("returns 0 when deletePattern throws error", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			mockKeys.mockRejectedValue(new Error("Redis keys failed"));

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.deletePattern("test:*");
			expect(result).toBe(0);
		});

		it("returns 0 keys when getStats throws error", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			mockKeys.mockRejectedValue(new Error("Redis stats failed"));

			const { cache } = await import("@/lib/redis-cache");

			const stats = await cache.getStats();
			expect(stats).toEqual({ keys: 0 });
		});

		it("wrap function still works when cache operations fail", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockGet = vi.mocked(Redis.fromEnv()).get;
			const mockSetex = vi.mocked(Redis.fromEnv()).setex;
			const mockFn = vi.fn().mockResolvedValue("fallback-value");

			mockGet.mockRejectedValue(new Error("Cache read failed"));
			mockSetex.mockRejectedValue(new Error("Cache write failed"));

			const { cache } = await import("@/lib/redis-cache");

			const result = await cache.wrap("test-key", mockFn);
			expect(result).toBe("fallback-value");
			expect(mockFn).toHaveBeenCalledTimes(1);
		});
	});

	describe("resource and organization invalidation", () => {
		it("invalidates organization cache", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			const mockDel = vi.mocked(Redis.fromEnv()).del;

			mockKeys.mockResolvedValue([
				"cache:users:org:123:1",
				"cache:posts:org:123:2",
			]);
			mockDel.mockResolvedValue(2);

			const { cache } = await import("@/lib/redis-cache");

			const count = await cache.invalidateOrganization(123);
			expect(count).toBe(2);
			expect(mockKeys).toHaveBeenCalledWith("cache:*:org:123:*");
			expect(mockDel).toHaveBeenCalledWith(
				"cache:users:org:123:1",
				"cache:posts:org:123:2",
			);
		});

		it("invalidates resource for organization", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			const mockDel = vi.mocked(Redis.fromEnv()).del;

			mockKeys.mockResolvedValue(["cache:users:org:456:1"]);
			mockDel.mockResolvedValue(1);

			const { cache } = await import("@/lib/redis-cache");

			const count = await cache.invalidateResource("users", 456);
			expect(count).toBe(1);
			expect(mockKeys).toHaveBeenCalledWith("cache:users:org:456:*");
			expect(mockDel).toHaveBeenCalledWith("cache:users:org:456:1");
		});

		it("invalidates resource globally", async () => {
			const { Redis } = await import("@upstash/redis");
			const mockKeys = vi.mocked(Redis.fromEnv()).keys;
			const mockDel = vi.mocked(Redis.fromEnv()).del;

			mockKeys.mockResolvedValue(["cache:users:1", "cache:users:2"]);
			mockDel.mockResolvedValue(2);

			const { cache } = await import("@/lib/redis-cache");

			const count = await cache.invalidateResource("users");
			expect(count).toBe(2);
			expect(mockKeys).toHaveBeenCalledWith("cache:users:*");
			expect(mockDel).toHaveBeenCalledWith("cache:users:1", "cache:users:2");
		});
	});
});
