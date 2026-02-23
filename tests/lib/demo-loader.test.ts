import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_IDS, getShareUrl, validateDemoData } from "@/lib/demo-loader";

describe("DEMO_IDS", () => {
  it("contains expected demo identifiers", () => {
    expect(DEMO_IDS.CHATBOT).toBe("chatbot-demo");
    expect(DEMO_IDS.RAG).toBe("rag-demo");
    expect(DEMO_IDS.CODEGEN).toBe("codegen-demo");
    expect(DEMO_IDS.SAFETY).toBe("safety-demo");
    expect(DEMO_IDS.MULTIMODAL).toBe("multimodal-demo");
  });
});

describe("getShareUrl", () => {
  it("generates share URL with base URL", () => {
    const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";

    const url = getShareUrl("test-id");

    expect(url).toBe("https://example.com/share/test-id");

    process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
  });

  it("handles empty base URL", () => {
    const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "";

    const url = getShareUrl("demo-123");

    expect(url).toBe("/share/demo-123");

    process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
  });

  it("handles undefined base URL", () => {
    const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const url = getShareUrl("my-demo");

    expect(url).toBe("/share/my-demo");

    process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
  });
});

describe("validateDemoData", () => {
  it("returns true for valid demo data", () => {
    const validData = {
      id: "demo-1",
      name: "Test Demo",
      type: "unit_test",
      summary: {
        totalTests: 10,
        passed: 8,
        failed: 2,
        passRate: "80%",
      },
      qualityScore: {
        score: 85,
        breakdown: {},
        flags: [],
      },
    };

    expect(validateDemoData(validData)).toBe(true);
  });

  it("returns false for null data", () => {
    expect(validateDemoData(null)).toBe(false);
  });

  it("returns false for undefined data", () => {
    expect(validateDemoData(undefined)).toBe(false);
  });

  it("returns false for non-object data", () => {
    expect(validateDemoData("string")).toBe(false);
    expect(validateDemoData(123)).toBe(false);
    expect(validateDemoData([])).toBe(false);
  });

  it("returns false when id is missing", () => {
    const data = {
      name: "Test",
      type: "unit_test",
      summary: { totalTests: 10 },
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when id is not a string", () => {
    const data = {
      id: 123,
      name: "Test",
      type: "unit_test",
      summary: { totalTests: 10 },
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when name is missing", () => {
    const data = {
      id: "demo-1",
      type: "unit_test",
      summary: { totalTests: 10 },
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when type is missing", () => {
    const data = {
      id: "demo-1",
      name: "Test",
      summary: { totalTests: 10 },
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when summary is missing", () => {
    const data = {
      id: "demo-1",
      name: "Test",
      type: "unit_test",
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when summary.totalTests is not a number", () => {
    const data = {
      id: "demo-1",
      name: "Test",
      type: "unit_test",
      summary: { totalTests: "ten" },
      qualityScore: { score: 85 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("returns false when qualityScore is missing", () => {
    const data = {
      id: "demo-1",
      name: "Test",
      type: "unit_test",
      summary: { totalTests: 10 },
    };

    expect(validateDemoData(data)).toBe(false);
  });

  it("accepts data with additional properties", () => {
    const data = {
      id: "demo-1",
      name: "Test",
      type: "unit_test",
      summary: { totalTests: 10 },
      qualityScore: { score: 85 },
      extraField: "extra value",
      testResults: [],
    };

    expect(validateDemoData(data)).toBe(true);
  });
});
