/**
 * Golden-path integration test
 *
 * Exercises the full evaluation lifecycle:
 *   1. Create evaluation
 *   2. Add test cases
 *   3. Publish (create version)
 *   4. Run evaluation
 *   5. Compute quality score
 *   6. CI gate check
 *   7. Generate signed report
 *   8. Detect drift
 *
 * This test validates module-level logic WITHOUT starting an HTTP server.
 * Service functions and utilities are called directly.
 */

import { describe, expect, it } from "vitest";
import { hasMinRole, hasScopes, normalizeRole } from "@/lib/api/secure-route";
import { SCOPES, scopesForRole } from "@/lib/auth/scopes";
import { meanAndStd, zScore } from "@/lib/drift/zscore";
import { signReport, verifyReport } from "@/lib/reports/sign";
import { computeQualityScore, type ScoreInputs } from "@/lib/scoring/quality-score";
import { wilsonConfidence } from "@/lib/services/aggregate-metrics.service";
import { EXIT } from "@/packages/sdk/src/cli/check";

describe("Golden-path lifecycle (unit-level)", () => {
  // ── Step 1-3: Evaluation creation & versioning are DB-dependent ──
  // Tested via their respective service unit tests. Here we validate the
  // scoring → gate → report → drift pipeline.

  // ── Step 4-5: Quality score computation ──
  describe("Quality Score", () => {
    it("computes a perfect score for a perfect run", () => {
      const inputs: ScoreInputs = {
        total: 100,
        passed: 100,
        safetyPassRate: 1.0,
        judgeAvg: 1.0,
        schemaPassRate: 1.0,
        avgLatencyMs: 500,
        avgCostUsd: 0.01,
        budgetUsd: 0.05,
      };
      const result = computeQualityScore(inputs);
      expect(result.score).toBe(100);
      expect(result.flags).toEqual([]);
    });

    it("flags low pass rate", () => {
      const result = computeQualityScore({ total: 100, passed: 60 });
      expect(result.flags).toContain("LOW_PASS_RATE");
      expect(result.score).toBeLessThan(80);
    });

    it("flags safety risk", () => {
      const result = computeQualityScore({
        total: 100,
        passed: 100,
        safetyPassRate: 0.8,
      });
      expect(result.flags).toContain("SAFETY_RISK");
    });

    it("provides confidence bands for aggregates", () => {
      const ci = wilsonConfidence(90, 100);
      expect(ci.lower).toBeGreaterThan(0.8);
      expect(ci.upper).toBeLessThanOrEqual(1);
      expect(ci.sampleSize).toBe(100);
    });
  });

  // ── Step 6: CI gate check ──
  describe("CI Gate (evalai check)", () => {
    it("exports standardized exit codes", () => {
      expect(EXIT.PASS).toBe(0);
      expect(EXIT.SCORE_BELOW).toBe(1);
      expect(EXIT.REGRESSION).toBe(2);
      expect(EXIT.POLICY_VIOLATION).toBe(3);
      expect(EXIT.API_ERROR).toBe(4);
      expect(EXIT.BAD_ARGS).toBe(5);
    });
  });

  // ── Step 7: Signed report ──
  describe("Report signing", () => {
    const secret = "test-secret-for-golden-path";

    it("signs and verifies a report round-trip", () => {
      const payload = {
        evaluationId: 42,
        score: 95,
        timestamp: "2026-01-01T00:00:00Z",
      };

      const { body, sig } = signReport(payload, secret);
      expect(verifyReport(body, sig, secret)).toBe(true);
    });

    it("rejects a tampered report", () => {
      const payload = { evaluationId: 42, score: 95 };
      const { body, sig } = signReport(payload, secret);

      const tampered = body.replace("95", "99");
      expect(verifyReport(tampered, sig, secret)).toBe(false);
    });

    it("rejects an incorrect secret", () => {
      const payload = { evaluationId: 42, score: 95 };
      const { body, sig } = signReport(payload, secret);
      expect(verifyReport(body, sig, "wrong-secret")).toBe(false);
    });
  });

  // ── Step 8: Drift detection ──
  describe("Drift detection", () => {
    it("computes z-score correctly", () => {
      // Mean=80, std=5, latest=65 → z = (65-80)/5 = -3
      expect(zScore(65, 80, 5)).toBe(-3);
    });

    it("returns 0 for zero std", () => {
      expect(zScore(80, 80, 0)).toBe(0);
    });

    it("computes mean and std", () => {
      const { mean, std } = meanAndStd([80, 85, 90, 75, 70]);
      expect(mean).toBe(80);
      expect(std).toBeGreaterThan(0);
    });
  });

  // ── Auth/scope sanity ──
  describe("Auth & scopes integration", () => {
    it("owner has all scopes", () => {
      const scopes = scopesForRole("owner");
      expect(hasScopes(scopes, [SCOPES.ADMIN_ORG, SCOPES.EVAL_WRITE, SCOPES.REPORTS_WRITE])).toBe(
        true,
      );
    });

    it("viewer cannot write", () => {
      const scopes = scopesForRole("viewer");
      expect(hasScopes(scopes, [SCOPES.EVAL_WRITE])).toBe(false);
    });

    it("role hierarchy works", () => {
      expect(hasMinRole(normalizeRole("admin"), "member")).toBe(true);
      expect(hasMinRole(normalizeRole("viewer"), "admin")).toBe(false);
    });
  });
});
