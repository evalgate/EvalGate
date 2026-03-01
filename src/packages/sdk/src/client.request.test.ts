import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIEvalClient } from "./client";
import * as errorsModule from "./errors";

vi.mock("./cache", () => {
	const cacheTracker = { invalidatedPatterns: [] as string[] };
	const shouldCache = vi.fn().mockReturnValue(true);
	const getTTL = vi.fn().mockReturnValue(1000);

	const makeKey = (method: string, url: string, params?: unknown) =>
		`${method}:${url}:${JSON.stringify(params ?? null)}`;

	return {
		__esModule: true,
		shouldCache,
		getTTL,
		cacheTracker,
		RequestCache: class RequestCache {
			private store = new Map<string, unknown>();

			get(method: string, url: string, params?: unknown) {
				const key = makeKey(method, url, params);
				return this.store.get(key) ?? null;
			}

			set(
				method: string,
				url: string,
				data: unknown,
				_ttl: number,
				params?: unknown,
			) {
				const key = makeKey(method, url, params);
				this.store.set(key, data);
			}

			invalidatePattern(pattern: string) {
				cacheTracker.invalidatedPatterns.push(pattern);
			}

			invalidate(_method: string, _url: string, _params?: unknown) {
				// no-op for tests
			}

			clear() {
				this.store.clear();
			}
		},
	};
});

import { cacheTracker, getTTL, shouldCache } from "./cache";

describe("AIEvalClient.request", () => {
	beforeEach(() => {
		process.env.EVALGATE_API_KEY = "test";
		shouldCache.mockReset().mockReturnValue(true);
		getTTL.mockReset().mockReturnValue(1000);
		cacheTracker.invalidatedPatterns.length = 0;
	});

	it("caches GET responses and reuses data without re-fetching", async () => {
		const client = new AIEvalClient({
			apiKey: "test",
			baseUrl: "http://localhost",
			timeout: 1000,
		});
		const payload = { items: [1, 2, 3] };
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => payload,
		});
		(globalThis as unknown).fetch = fetchMock;

		const first = await client.request("/api/traces", { method: "GET" });
		const second = await client.request("/api/traces", { method: "GET" });

		expect(first).toEqual(payload);
		expect(second).toEqual(payload);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("propagates non-ok responses as SDK errors", async () => {
		const client = new AIEvalClient({
			apiKey: "test",
			baseUrl: "http://localhost",
		});
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 429,
			json: async () => ({ error: { code: "RATE_LIMIT_EXCEEDED" } }),
		});
		(globalThis as unknown).fetch = fetchMock;
		const createErrorSpy = vi
			.spyOn(errorsModule, "createErrorFromResponse")
			.mockReturnValue(
				new errorsModule.EvalGateError(
					"rate limited",
					"RATE_LIMIT_EXCEEDED",
					429,
				),
			);

		await expect(
			client.request("/api/fail", { method: "GET" }),
		).rejects.toHaveProperty("code", "RATE_LIMIT_EXCEEDED");
		createErrorSpy.mockRestore();
	});

	it("retries on retryable SDK errors and eventually succeeds", async () => {
		const client = new AIEvalClient({
			apiKey: "test",
			baseUrl: "http://localhost",
			timeout: 1000,
		});
		vi.spyOn(client as unknown, "calculateBackoff").mockReturnValue(0);

		const failureResponse = {
			ok: false,
			status: 429,
			json: async () => ({ error: { code: "RATE_LIMIT_EXCEEDED" } }),
		};
		const successResponse = {
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		};

		const createErrorSpy = vi
			.spyOn(errorsModule, "createErrorFromResponse")
			.mockReturnValue(
				new errorsModule.EvalGateError(
					"rate limited",
					"RATE_LIMIT_EXCEEDED",
					429,
				),
			);

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(failureResponse)
			.mockResolvedValueOnce(successResponse);
		(globalThis as unknown).fetch = fetchMock;

		const result = await client.request("/api/retry", { method: "GET" });
		expect(result).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		createErrorSpy.mockRestore();
	});

	it("throws a TIMEOUT SDK error when fetch aborts", async () => {
		const client = new AIEvalClient({
			apiKey: "test",
			baseUrl: "http://localhost",
			timeout: 1000,
		});
		const abortError = Object.assign(new Error("aborted"), {
			name: "AbortError",
		});
		const fetchMock = vi.fn().mockRejectedValue(abortError);
		(globalThis as unknown).fetch = fetchMock;

		await expect(
			client.request("/api/timeout", { method: "GET" }),
		).rejects.toMatchObject({
			code: "TIMEOUT",
		});
	});

	it("invalidates related cache entries for mutation requests", async () => {
		const client = new AIEvalClient({
			apiKey: "test",
			baseUrl: "http://localhost",
			timeout: 1000,
		});
		shouldCache.mockReturnValue(false);

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ result: "ok" }),
		});
		(globalThis as unknown).fetch = fetchMock;

		await client.request("/api/evaluations", {
			method: "POST",
			body: JSON.stringify({}),
		});

		expect(cacheTracker.invalidatedPatterns).toContain("evaluations");
	});
});
