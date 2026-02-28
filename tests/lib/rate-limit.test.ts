import { describe, expect, it } from "vitest";
import { checkRateLimit, getRateLimitTier } from "@/lib/rate-limit";

describe("rate-limit helpers", () => {
	it("falls back to conservative in-memory limiter when Redis is not configured", async () => {
		const identifier = "test-id";
		const result = await checkRateLimit(identifier, "anonymous");

		expect(result.success).toBe(true);
		const limit = Number(result.headers["X-RateLimit-Limit"]);
		expect(limit).toBeGreaterThan(0);
		expect(limit).toBeLessThan(30);
	});

	it("derives tier from plan names case-insensitively", () => {
		expect(getRateLimitTier("Enterprise")).toBe("enterprise");
		expect(getRateLimitTier("Pro Plus")).toBe("pro");
		expect(getRateLimitTier("FREE-start")).toBe("free");
		expect(getRateLimitTier("unknown")).toBe("anonymous");
		expect(getRateLimitTier(undefined)).toBe("anonymous");
	});
});
