/**
 * JSON formatter tests.
 * Assert output is parseable JSON only.
 */

import { describe, expect, it } from "vitest";
import { formatJson } from "../../cli/formatters/json";
import type { CheckReport } from "../../cli/formatters/types";

describe("formatJson", () => {
  it("outputs parseable JSON only", () => {
    const report: CheckReport = {
      evaluationId: "eval-123",
      verdict: "pass",
      reasonCode: "LOW_SCORE",
      score: 85,
      dashboardUrl: "https://example.com/dash",
    };
    const out = formatJson(report);
    expect(() => JSON.parse(out)).not.toThrow();
    const parsed = JSON.parse(out);
    expect(parsed.evaluationId).toBe("eval-123");
    expect(parsed.verdict).toBe("pass");
    expect(parsed.score).toBe(85);
  });

  it("outputs no extra text (JSON only)", () => {
    const report: CheckReport = {
      evaluationId: "x",
      verdict: "fail",
      reasonCode: "BASELINE_MISSING",
    };
    const out = formatJson(report);
    expect(out.trim()).toMatch(/^\{.*\}$/s);
    expect(JSON.parse(out)).toBeDefined();
  });
});
