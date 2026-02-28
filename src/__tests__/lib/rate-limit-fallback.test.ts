import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@upstash/ratelimit", () => ({
	Ratelimit: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
	Redis: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@sentry/nextjs", () => ({
	captureEvent: vi.fn(),
}));

describe("rate-limit fallback (Redis unavailable)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.UPSTASH_REDIS_REST_URL;
		delete process.env.UPSTASH_REDIS_REST_TOKEN;
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function loadCheckRateLimit() {
		const mod = await import("@/lib/rate-limit");
		return mod.checkRateLimit;
	}

	it("returns success: false for sensitive routes when Redis is unavailable", async () => {
		const checkRateLimit = await loadCheckRateLimit();
		const result = await checkRateLimit("user-1", "free", "sensitive");

		expect(result.success).toBe(false);
		expect(result.headers["X-RateLimit-Limit"]).toBe("0");
		expect(result.headers["X-RateLimit-Remaining"]).toBe("0");
		expect(result.headers["Retry-After"]).toBeDefined();
	});

	it("allows up to 1/4 of tier limit for read-only routes via in-memory fallback", async () => {
		const checkRateLimit = await loadCheckRateLimit();
		const freeLimit = 200;
		const quarterLimit = Math.floor(freeLimit / 4); // 50

		const results: boolean[] = [];
		for (let i = 0; i < quarterLimit + 5; i++) {
			const result = await checkRateLimit("user-2", "free", "read-only");
			results.push(result.success);
		}

		const successes = results.filter(Boolean).length;
		expect(successes).toBe(quarterLimit);

		const lastResult = results[results.length - 1];
		expect(lastResult).toBe(false);
	});

	it("logs error via logger only once per process", async () => {
		const { logger } = await import("@/lib/logger");
		const checkRateLimit = await loadCheckRateLimit();

		await checkRateLimit("user-3", "free", "read-only");
		await checkRateLimit("user-3", "free", "read-only");
		await checkRateLimit("user-3", "free", "read-only");

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			"Redis unavailable — rate limiting falling back to in-memory",
			expect.objectContaining({ tier: "free", routeRisk: "read-only" }),
		);
	});

	it("captures a Sentry event on each fallback call", async () => {
		const Sentry = await import("@sentry/nextjs");
		const checkRateLimit = await loadCheckRateLimit();

		await checkRateLimit("user-4", "anonymous", "read-only");
		await checkRateLimit("user-5", "anonymous", "read-only");

		expect(Sentry.captureEvent).toHaveBeenCalledTimes(2);
		expect(Sentry.captureEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Rate-limit Redis unavailable, using fallback",
				level: "warning",
			}),
		);
	});

	it("clears memory store when exceeding MAX_MEMORY_KEYS", async () => {
		const checkRateLimit = await loadCheckRateLimit();

		// MAX_MEMORY_KEYS is 10_000 — fill the store with unique identifiers
		for (let i = 0; i < 10_001; i++) {
			await checkRateLimit(`user-overflow-${i}`, "enterprise", "read-only");
		}

		// After clearing, a previously-used identifier should be allowed again
		const result = await checkRateLimit(
			"user-overflow-0",
			"enterprise",
			"read-only",
		);
		expect(result.success).toBe(true);
	});
});
