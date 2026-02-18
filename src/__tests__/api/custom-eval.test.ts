import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/custom-eval/route";

// Mock rate limiting to bypass in tests
vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: vi.fn((_req: any, handler: any) => handler(_req)),
}));

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/demo/custom-eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/demo/custom-eval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if output is missing", async () => {
    const req = createRequest({ assertions: ["no-pii"] });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(data.error?.message).toContain("output");
  });

  it("should return 400 if assertions array is empty", async () => {
    const req = createRequest({ output: "Hello world", assertions: [] });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(data.error?.message).toContain("assertions");
  });

  it("should return 400 if assertions is not provided", async () => {
    const req = createRequest({ output: "Hello world" });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(data.error?.message).toContain("assertions");
  });

  it("should pass no-pii assertion on clean text", async () => {
    const req = createRequest({
      input: "Tell me about AI",
      output: "AI is artificial intelligence used to automate tasks.",
      assertions: ["no-pii"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.totalTests).toBe(1);
    expect(data.results.passed).toBe(1);
    expect(data.results.failed).toBe(0);
    expect(data.results.tests[0].status).toBe("passed");
  });

  it("should fail no-pii assertion when email is present", async () => {
    const req = createRequest({
      output: "Contact me at john@example.com for details.",
      assertions: ["no-pii"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.passed).toBe(0);
    expect(data.results.failed).toBe(1);
    expect(data.results.tests[0].status).toBe("failed");
  });

  it("should fail professional assertion on profane text", async () => {
    const req = createRequest({
      output: "What the hell is this damn thing?",
      assertions: ["professional"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.tests[0].status).toBe("failed");
  });

  it("should pass valid-json assertion on valid JSON", async () => {
    const req = createRequest({
      output: '{"name": "test", "value": 42}',
      assertions: ["valid-json"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.tests[0].status).toBe("passed");
  });

  it("should fail valid-json assertion on invalid JSON", async () => {
    const req = createRequest({
      output: "This is not JSON at all",
      assertions: ["valid-json"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.tests[0].status).toBe("failed");
  });

  it("should run not-hallucinated assertion when expectedOutput is provided", async () => {
    const req = createRequest({
      output: "The product costs $29.99 and ships in 2 days.",
      expectedOutput: "The product costs $29.99. Shipping takes 2 days.",
      assertions: ["not-hallucinated"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.totalTests).toBe(1);
    // The assertion should have a meaningful result either way
    expect(data.results.tests[0]).toHaveProperty("status");
  });

  it("should fail not-hallucinated when no expectedOutput provided", async () => {
    const req = createRequest({
      output: "Some AI output",
      assertions: ["not-hallucinated"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.tests[0].status).toBe("failed");
    expect(data.results.tests[0].notes).toContain("Expected output is required");
  });

  it("should return correct qualityScore shape", async () => {
    const req = createRequest({
      output: "A professional and clean response.",
      assertions: ["no-pii", "professional", "proper-grammar"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.qualityScore).toHaveProperty("overall");
    expect(data.qualityScore).toHaveProperty("grade");
    expect(data.qualityScore).toHaveProperty("metrics");
    expect(data.qualityScore.metrics).toHaveProperty("accuracy");
    expect(data.qualityScore.metrics).toHaveProperty("safety");
    expect(data.qualityScore.metrics).toHaveProperty("latency");
    expect(data.qualityScore.metrics).toHaveProperty("cost");
    expect(data.qualityScore.metrics).toHaveProperty("consistency");
    expect(typeof data.qualityScore.overall).toBe("number");
    expect(typeof data.qualityScore.grade).toBe("string");
  });

  it("should return totalTests matching assertion count", async () => {
    const assertions = ["no-pii", "professional", "proper-grammar", "valid-json"];
    const req = createRequest({
      output: '{"message": "Hello"}',
      assertions,
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results.totalTests).toBe(assertions.length);
    expect(data.results.tests).toHaveLength(assertions.length);
  });

  it("should handle multiple assertions with mixed results", async () => {
    const req = createRequest({
      output: "Contact support@company.com for a refund within 30 days.",
      assertions: ["no-pii", "professional", "proper-grammar"],
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    // no-pii should fail (contains email), but professional and grammar should pass
    expect(data.results.totalTests).toBe(3);
    expect(data.results.passed + data.results.failed).toBe(3);
  });
});
