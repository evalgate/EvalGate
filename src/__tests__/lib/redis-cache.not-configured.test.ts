import { beforeEach, describe, expect, it } from "vitest";

describe("redis-cache (not configured)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("get returns null/undefined when redis is not configured", { timeout: 10000 }, async () => {
    const mod = await import("@/lib/redis-cache");
    const modAny = mod as Record<string, unknown>;
    const cache = modAny.cache as Record<string, unknown>;
    const get = cache.get as (key: string) => Promise<unknown>;
    const val = await get("k1");
    expect(val == null).toBe(true);
  });

  it("set does not throw when redis is not configured", async () => {
    const mod = await import("@/lib/redis-cache");
    const modAny = mod as Record<string, unknown>;
    const cache = modAny.cache as Record<string, unknown>;
    const set = cache.set as (key: string, value: unknown, ttl?: number) => Promise<unknown>;
    const result = await set("k1", "v1", 60);
    expect(result).toBeFalsy();
  });
});
