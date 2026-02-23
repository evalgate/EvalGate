import { describe, expect, it } from "vitest";
import {
  type ABTestExportData,
  type BaseExportData,
  formatExportData,
  generateExportFilename,
  getExportDescription,
  getRecommendedExportFormat,
  type HumanEvalExportData,
  type ModelEvalExportData,
  type UnitTestExportData,
  validateExportData,
} from "@/lib/export-templates";

const createBaseData = (
  type: "unit_test" | "human_eval" | "model_eval" | "ab_test",
): BaseExportData => ({
  evaluation: {
    id: "eval-123",
    name: "Test Evaluation",
    description: "A test evaluation",
    type,
    created_at: "2024-01-01T00:00:00Z",
  },
  timestamp: "2024-01-01T12:00:00Z",
  summary: {
    totalTests: 10,
    passed: 8,
    failed: 2,
    passRate: "80%",
  },
  qualityScore: {
    score: 85,
    breakdown: { accuracy: 90, relevance: 80 },
    flags: [],
    evidenceLevel: "high",
    scoringVersion: "1.0",
  },
});

describe("formatExportData", () => {
  it("formats unit_test export data correctly", () => {
    const baseData = createBaseData("unit_test");
    const additionalData = {
      testResults: [
        {
          id: "1",
          name: "Test 1",
          input: "input",
          expected_output: "expected",
          actual_output: "actual",
          passed: true,
        },
      ],
      codeValidation: { syntax_errors: 0, runtime_errors: 0, assertion_failures: 1 },
    };

    const result = formatExportData(baseData, additionalData) as UnitTestExportData;

    expect(result.type).toBe("unit_test");
    expect(result.testResults).toHaveLength(1);
    expect(result.codeValidation?.syntax_errors).toBe(0);
  });

  it("formats human_eval export data correctly", () => {
    const baseData = createBaseData("human_eval");
    const additionalData = {
      evaluations: [
        {
          id: "1",
          evaluator_id: "user1",
          ratings: { quality: 5 },
          comments: "Good",
          timestamp: "2024-01-01",
        },
      ],
      interRaterReliability: { agreement_percentage: 85 },
      criteria: [{ name: "Quality", description: "Overall quality", scale: "1-5" }],
    };

    const result = formatExportData(baseData, additionalData) as HumanEvalExportData;

    expect(result.type).toBe("human_eval");
    expect(result.evaluations).toHaveLength(1);
    expect(result.criteria).toHaveLength(1);
    expect(result.interRaterReliability?.agreement_percentage).toBe(85);
  });

  it("formats model_eval export data correctly", () => {
    const baseData = createBaseData("model_eval");
    const additionalData = {
      judgeEvaluations: [
        {
          id: "1",
          test_case_id: "tc1",
          judge_model: "gpt-4",
          input: "test",
          response: "response",
          judgment: { label: "pass", score: 90, reasoning: "Good" },
        },
      ],
      judgePrompt: "Evaluate this response",
      judgeModel: "gpt-4-turbo",
      aggregateMetrics: { average_score: 88 },
    };

    const result = formatExportData(baseData, additionalData) as ModelEvalExportData;

    expect(result.type).toBe("model_eval");
    expect(result.judgeEvaluations).toHaveLength(1);
    expect(result.judgePrompt).toBe("Evaluate this response");
    expect(result.judgeModel).toBe("gpt-4-turbo");
  });

  it("formats ab_test export data correctly", () => {
    const baseData = createBaseData("ab_test");
    const additionalData = {
      variants: [{ id: "a", name: "Variant A", description: "Control" }],
      results: [
        {
          variant_id: "a",
          variant_name: "Variant A",
          test_count: 100,
          success_rate: 0.85,
          average_latency: 150,
          average_cost: 0.01,
          quality_score: 88,
        },
      ],
      statisticalSignificance: { p_value: 0.03, confidence_level: 0.95, effect_size: 0.15 },
      comparison: {
        metric: "quality_score",
        baseline_variant: "Variant A",
        winner_variant: "Variant B",
        improvement_percentage: 12,
      },
    };

    const result = formatExportData(baseData, additionalData) as ABTestExportData;

    expect(result.type).toBe("ab_test");
    expect(result.variants).toHaveLength(1);
    expect(result.results).toHaveLength(1);
    expect(result.statisticalSignificance?.p_value).toBe(0.03);
  });

  it("handles empty additional data gracefully", () => {
    const baseData = createBaseData("unit_test");
    const result = formatExportData(baseData, {}) as UnitTestExportData;

    expect(result.type).toBe("unit_test");
    expect(result.testResults).toEqual([]);
  });

  it("throws error for unsupported type", () => {
    const baseData = createBaseData("unit_test");
    (baseData.evaluation as any).type = "invalid_type";

    expect(() => formatExportData(baseData, {})).toThrow("Unsupported export type");
  });

  it("uses default judgeModel when not provided", () => {
    const baseData = createBaseData("model_eval");
    const result = formatExportData(baseData, {}) as ModelEvalExportData;

    expect(result.judgeModel).toBe("gpt-4");
  });

  it("uses default comparison when not provided for ab_test", () => {
    const baseData = createBaseData("ab_test");
    const additionalData = { variants: [{ name: "Control" }] };
    const result = formatExportData(baseData, additionalData) as ABTestExportData;

    expect(result.comparison.metric).toBe("quality_score");
    expect(result.comparison.baseline_variant).toBe("Control");
  });
});

describe("generateExportFilename", () => {
  it("generates filename with category", () => {
    const filename = generateExportFilename("My Evaluation", "unit_test", "chatbot");

    expect(filename).toMatch(/^unit_test-chatbot-my-evaluation-\d+\.json$/);
  });

  it("generates filename without category", () => {
    const filename = generateExportFilename("Test Eval", "model_eval");

    expect(filename).toMatch(/^model_eval-test-eval-\d+\.json$/);
  });

  it("sanitizes spaces in evaluation name", () => {
    const filename = generateExportFilename("My   Multi  Space   Name", "ab_test");

    expect(filename).toMatch(/^ab_test-my-multi-space-name-\d+\.json$/);
  });

  it("converts name to lowercase", () => {
    const filename = generateExportFilename("UPPERCASE NAME", "human_eval");

    expect(filename).toMatch(/^human_eval-uppercase-name-\d+\.json$/);
  });
});

describe("getExportDescription", () => {
  it("returns correct description for unit_test", () => {
    expect(getExportDescription("unit_test")).toBe(
      "Automated test results with code validation metrics",
    );
  });

  it("returns correct description for human_eval", () => {
    expect(getExportDescription("human_eval")).toBe(
      "Human evaluation ratings with inter-rater reliability",
    );
  });

  it("returns correct description for model_eval", () => {
    expect(getExportDescription("model_eval")).toBe("LLM judge evaluations with aggregate metrics");
  });

  it("returns correct description for ab_test", () => {
    expect(getExportDescription("ab_test")).toBe(
      "A/B test results with statistical significance analysis",
    );
  });
});

describe("getRecommendedExportFormat", () => {
  it("returns json for all types", () => {
    expect(getRecommendedExportFormat("unit_test")).toBe("json");
    expect(getRecommendedExportFormat("human_eval")).toBe("json");
    expect(getRecommendedExportFormat("model_eval")).toBe("json");
    expect(getRecommendedExportFormat("ab_test")).toBe("json");
  });
});

describe("validateExportData", () => {
  it("validates complete unit_test data", () => {
    const data: UnitTestExportData = {
      ...createBaseData("unit_test"),
      type: "unit_test",
      testResults: [
        {
          id: "1",
          name: "Test",
          input: "in",
          expected_output: "out",
          actual_output: "out",
          passed: true,
        },
      ],
    };

    const result = validateExportData(data);

    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it("detects missing evaluation.id", () => {
    const data = {
      ...createBaseData("unit_test"),
      type: "unit_test" as const,
      testResults: [
        {
          id: "1",
          name: "Test",
          input: "in",
          expected_output: "out",
          actual_output: "out",
          passed: true,
        },
      ],
    };
    (data.evaluation as any).id = undefined;

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("evaluation.id");
  });

  it("detects missing testResults for unit_test", () => {
    const data: UnitTestExportData = {
      ...createBaseData("unit_test"),
      type: "unit_test",
      testResults: [],
    };

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("testResults");
  });

  it("detects missing evaluations and criteria for human_eval", () => {
    const data: HumanEvalExportData = {
      ...createBaseData("human_eval"),
      type: "human_eval",
      evaluations: [],
      criteria: [],
    };

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("evaluations");
    expect(result.missingFields).toContain("criteria");
  });

  it("detects missing judgeEvaluations and judgePrompt for model_eval", () => {
    const data: ModelEvalExportData = {
      ...createBaseData("model_eval"),
      type: "model_eval",
      judgeEvaluations: [],
      judgePrompt: "",
      judgeModel: "gpt-4",
    };

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("judgeEvaluations");
    expect(result.missingFields).toContain("judgePrompt");
  });

  it("detects missing variants and results for ab_test", () => {
    const data: ABTestExportData = {
      ...createBaseData("ab_test"),
      type: "ab_test",
      variants: [],
      results: [],
      comparison: { metric: "quality", baseline_variant: "A" },
    };

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("variants");
    expect(result.missingFields).toContain("results");
  });

  it("detects missing qualityScore", () => {
    const data = {
      ...createBaseData("unit_test"),
      type: "unit_test" as const,
      testResults: [
        {
          id: "1",
          name: "Test",
          input: "in",
          expected_output: "out",
          actual_output: "out",
          passed: true,
        },
      ],
    };
    (data as any).qualityScore = undefined;

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("qualityScore");
  });

  it("detects missing summary", () => {
    const data = {
      ...createBaseData("unit_test"),
      type: "unit_test" as const,
      testResults: [
        {
          id: "1",
          name: "Test",
          input: "in",
          expected_output: "out",
          actual_output: "out",
          passed: true,
        },
      ],
    };
    (data as any).summary = undefined;

    const result = validateExportData(data);

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain("summary");
  });
});
