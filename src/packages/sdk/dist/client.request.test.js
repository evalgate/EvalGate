"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("./client");
const errorsModule = __importStar(require("./errors"));
vitest_1.vi.mock("./cache", () => {
    const cacheTracker = { invalidatedPatterns: [] };
    const shouldCache = vitest_1.vi.fn().mockReturnValue(true);
    const getTTL = vitest_1.vi.fn().mockReturnValue(1000);
    const makeKey = (method, url, params) => `${method}:${url}:${JSON.stringify(params ?? null)}`;
    return {
        __esModule: true,
        shouldCache,
        getTTL,
        cacheTracker,
        RequestCache: class RequestCache {
            constructor() {
                this.store = new Map();
            }
            get(method, url, params) {
                const key = makeKey(method, url, params);
                return this.store.get(key) ?? null;
            }
            set(method, url, data, _ttl, params) {
                const key = makeKey(method, url, params);
                this.store.set(key, data);
            }
            invalidatePattern(pattern) {
                cacheTracker.invalidatedPatterns.push(pattern);
            }
            invalidate(_method, _url, _params) {
                // no-op for tests
            }
            clear() {
                this.store.clear();
            }
        },
    };
});
const cache_1 = require("./cache");
(0, vitest_1.describe)("AIEvalClient.request", () => {
    (0, vitest_1.beforeEach)(() => {
        process.env.EVALAI_API_KEY = "test";
        cache_1.shouldCache.mockReset().mockReturnValue(true);
        cache_1.getTTL.mockReset().mockReturnValue(1000);
        cache_1.cacheTracker.invalidatedPatterns.length = 0;
    });
    (0, vitest_1.it)("caches GET responses and reuses data without re-fetching", async () => {
        const client = new client_1.AIEvalClient({ apiKey: "test", baseUrl: "http://localhost", timeout: 1000 });
        const payload = { items: [1, 2, 3] };
        const fetchMock = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => payload,
        });
        globalThis.fetch = fetchMock;
        const first = await client.request("/api/traces", { method: "GET" });
        const second = await client.request("/api/traces", { method: "GET" });
        (0, vitest_1.expect)(first).toEqual(payload);
        (0, vitest_1.expect)(second).toEqual(payload);
        (0, vitest_1.expect)(fetchMock).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("propagates non-ok responses as SDK errors", async () => {
        const client = new client_1.AIEvalClient({ apiKey: "test", baseUrl: "http://localhost" });
        const fetchMock = vitest_1.vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({ error: { code: "RATE_LIMIT_EXCEEDED" } }),
        });
        globalThis.fetch = fetchMock;
        const createErrorSpy = vitest_1.vi
            .spyOn(errorsModule, "createErrorFromResponse")
            .mockReturnValue(new errorsModule.EvalAIError("rate limited", "RATE_LIMIT_EXCEEDED", 429));
        await (0, vitest_1.expect)(client.request("/api/fail", { method: "GET" })).rejects.toHaveProperty("code", "RATE_LIMIT_EXCEEDED");
        createErrorSpy.mockRestore();
    });
    (0, vitest_1.it)("retries on retryable SDK errors and eventually succeeds", async () => {
        const client = new client_1.AIEvalClient({ apiKey: "test", baseUrl: "http://localhost", timeout: 1000 });
        vitest_1.vi.spyOn(client, "calculateBackoff").mockReturnValue(0);
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
        const createErrorSpy = vitest_1.vi
            .spyOn(errorsModule, "createErrorFromResponse")
            .mockReturnValue(new errorsModule.EvalAIError("rate limited", "RATE_LIMIT_EXCEEDED", 429));
        const fetchMock = vitest_1.vi
            .fn()
            .mockResolvedValueOnce(failureResponse)
            .mockResolvedValueOnce(successResponse);
        globalThis.fetch = fetchMock;
        const result = await client.request("/api/retry", { method: "GET" });
        (0, vitest_1.expect)(result).toEqual({ ok: true });
        (0, vitest_1.expect)(fetchMock).toHaveBeenCalledTimes(2);
        createErrorSpy.mockRestore();
    });
    (0, vitest_1.it)("throws a TIMEOUT SDK error when fetch aborts", async () => {
        const client = new client_1.AIEvalClient({ apiKey: "test", baseUrl: "http://localhost", timeout: 1000 });
        const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
        const fetchMock = vitest_1.vi.fn().mockRejectedValue(abortError);
        globalThis.fetch = fetchMock;
        await (0, vitest_1.expect)(client.request("/api/timeout", { method: "GET" })).rejects.toMatchObject({
            code: "TIMEOUT",
        });
    });
    (0, vitest_1.it)("invalidates related cache entries for mutation requests", async () => {
        const client = new client_1.AIEvalClient({ apiKey: "test", baseUrl: "http://localhost", timeout: 1000 });
        cache_1.shouldCache.mockReturnValue(false);
        const fetchMock = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ result: "ok" }),
        });
        globalThis.fetch = fetchMock;
        await client.request("/api/evaluations", { method: "POST", body: JSON.stringify({}) });
        (0, vitest_1.expect)(cache_1.cacheTracker.invalidatedPatterns).toContain("evaluations");
    });
});
