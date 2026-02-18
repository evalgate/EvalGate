import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIEvalClient } from "../client";

// Mock fetch globally
const mockFetch = vi.fn();

describe("AIEvalClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("constructor", () => {
    it("should throw if no API key is provided", () => {
      expect(() => new AIEvalClient({ apiKey: "" })).toThrow("API key is required");
    });

    it("should initialize with explicit config", () => {
      const client = new AIEvalClient({
        apiKey: "test-key",
        baseUrl: "https://api.test.com",
        organizationId: 42,
      });
      expect(client).toBeDefined();
      expect(client.getOrganizationId()).toBe(42);
    });

    it("should have all API modules", () => {
      const client = new AIEvalClient({ apiKey: "test-key" });
      expect(client.traces).toBeDefined();
      expect(client.evaluations).toBeDefined();
      expect(client.llmJudge).toBeDefined();
      expect(client.annotations).toBeDefined();
      expect(client.developer).toBeDefined();
      expect(client.organizations).toBeDefined();
    });
  });

  describe("request method", () => {
    it("should send auth header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
        status: 200,
      });

      const client = new AIEvalClient({
        apiKey: "my-secret-key",
        baseUrl: "http://localhost:3000",
      });
      await client.request("/api/test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/test");
      expect(options.headers.Authorization).toBe("Bearer my-secret-key");
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("should return parsed JSON on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: "ok" }),
        status: 200,
      });

      const client = new AIEvalClient({ apiKey: "key", baseUrl: "http://localhost:3000" });
      const data = await client.request("/api/test");
      expect(data).toEqual({ result: "ok" });
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Not found", code: "NOT_FOUND" }),
        status: 404,
      });

      const client = new AIEvalClient({
        apiKey: "key",
        baseUrl: "http://localhost:3000",
        retry: { maxAttempts: 1 },
      });
      await expect(client.request("/api/test")).rejects.toThrow();
    });

    it("should retry on rate limit errors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Rate limited", code: "RATE_LIMIT_EXCEEDED" }),
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: "success" }),
          status: 200,
        });

      const client = new AIEvalClient({
        apiKey: "key",
        baseUrl: "http://localhost:3000",
        retry: { maxAttempts: 3, backoff: "fixed" },
      });

      const data = await client.request("/api/test");
      expect(data).toEqual({ result: "success" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle timeout", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            setTimeout(() => reject(abortError), 50);
          }),
      );

      const client = new AIEvalClient({
        apiKey: "key",
        baseUrl: "http://localhost:3000",
        timeout: 10,
        retry: { maxAttempts: 1 },
      });

      await expect(client.request("/api/slow")).rejects.toThrow();
    });
  });

  describe("TraceAPI", () => {
    it("should call correct endpoint for traces.create", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, name: "Test Trace", traceId: "trace-1" }),
        status: 200,
      });

      const client = new AIEvalClient({
        apiKey: "key",
        baseUrl: "http://localhost:3000",
        organizationId: 1,
      });
      const result = await client.traces.create({ name: "Test Trace", traceId: "trace-1" });

      expect(result.name).toBe("Test Trace");
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/traces");
      expect(options.method).toBe("POST");
    });

    it("should call correct endpoint for traces.list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
        status: 200,
      });

      const client = new AIEvalClient({ apiKey: "key", baseUrl: "http://localhost:3000" });
      await client.traces.list({ limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/traces");
      expect(url).toContain("limit=10");
    });
  });

  describe("EvaluationAPI", () => {
    it("should call correct endpoint for evaluations.create", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, name: "Eval" }),
        status: 200,
      });

      const client = new AIEvalClient({
        apiKey: "key",
        baseUrl: "http://localhost:3000",
        organizationId: 1,
      });
      await client.evaluations.create({
        name: "Eval",
        type: "unit_test",
        organizationId: 1,
        createdBy: 1,
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/evaluations");
      expect(options.method).toBe("POST");
    });

    it("should call correct endpoint for evaluations.createRun", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, status: "running" }),
        status: 200,
      });

      const client = new AIEvalClient({ apiKey: "key", baseUrl: "http://localhost:3000" });
      await client.evaluations.createRun(42, { status: "running" } as any);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/evaluations/42/runs");
      expect(options.method).toBe("POST");
    });
  });

  describe("LLMJudgeAPI", () => {
    it("should call correct endpoint for llmJudge.evaluate", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: { score: 85 }, config: {} }),
        status: 200,
      });

      const client = new AIEvalClient({ apiKey: "key", baseUrl: "http://localhost:3000" });
      const result = await client.llmJudge.evaluate({
        configId: 1,
        input: "test input",
        output: "test output",
      });

      expect(result.result.score).toBe(85);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3000/api/llm-judge/evaluate");
      expect(options.method).toBe("POST");
    });
  });
});
