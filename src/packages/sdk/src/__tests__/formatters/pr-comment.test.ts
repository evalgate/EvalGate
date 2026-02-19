/**
 * PR comment formatter tests.
 * Snapshot test for deterministic markdown output.
 */

import { describe, expect, it } from "vitest";
import { buildPrComment } from "../../cli/formatters/pr-comment";
import type { CheckReport } from "../../cli/formatters/types";

describe("buildPrComment", () => {
  it("produces deterministic markdown for PASS", () => {
    const report: CheckReport = {
      evaluationId: "eval-1",
      verdict: "pass",
      reasonCode: "UNKNOWN",
      score: 95,
      dashboardUrl: "https://example.com/dash",
    };
    const out = buildPrComment(report);
    expect(out).toContain("## ✅ EvalAI Regression Gate — PASSED");
    expect(out).toContain("**Score:** 95/100");
    expect(out).toContain("**Reason:** UNKNOWN");
    expect(out).toContain("[Dashboard](https://example.com/dash)");
  });

  it("produces deterministic markdown for FAIL with top failures", () => {
    const report: CheckReport = {
      evaluationId: "eval-1",
      verdict: "fail",
      reasonCode: "LOW_SCORE",
      reasonMessage: "Score below threshold",
      score: 84,
      baselineScore: 90,
      delta: -6,
      failedCases: [
        { testCaseId: 1, name: "tc1", reason: "assertion failed" },
        { testCaseId: 2, name: "tc2", output: "wrong output" },
      ],
      dashboardUrl: "https://example.com/dash",
    };
    const out = buildPrComment(report);
    expect(out).toContain("## 🚨 EvalAI Regression Gate — FAILED");
    expect(out).toContain("**Score:** 84/100 (-6 from baseline 90)");
    expect(out).toContain("**Reason:** LOW_SCORE");
    expect(out).toContain("### Top Issues");
    expect(out).toContain("tc1");
    expect(out).toContain("tc2");
  });

  it("includes share URL when present", () => {
    const report: CheckReport = {
      evaluationId: "eval-1",
      verdict: "fail",
      reasonCode: "LOW_SCORE",
      score: 70,
      dashboardUrl: "https://example.com/dash",
      shareUrl: "https://example.com/share/abc123",
    };
    const out = buildPrComment(report);
    expect(out).toContain("[Dashboard](https://example.com/dash)");
    expect(out).toContain("[Share Snapshot](https://example.com/share/abc123)");
  });

  it("includes policy when present", () => {
    const report: CheckReport = {
      evaluationId: "eval-1",
      verdict: "fail",
      reasonCode: "POLICY_VIOLATION",
      score: 70,
      policy: "HIPAA",
    };
    const out = buildPrComment(report);
    expect(out).toContain("**Policy:** HIPAA");
  });

  it("limits top failures to 3", () => {
    const report: CheckReport = {
      evaluationId: "eval-1",
      verdict: "fail",
      reasonCode: "LOW_SCORE",
      score: 70,
      failedCases: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
    };
    const out = buildPrComment(report);
    expect(out).toContain("a");
    expect(out).toContain("b");
    expect(out).toContain("c");
    expect(out).toContain("+ 1 more");
  });
});
