/**
 * Gate profile resolution tests.
 */

import { describe, expect, it } from "vitest";
import { parseArgs } from "../../cli/check";
import { PROFILES } from "../../cli/profiles";

describe("profiles", () => {
  it("strict profile maps correctly", () => {
    expect(PROFILES.strict).toEqual({
      minScore: 95,
      maxDrop: 0,
      warnDrop: 0,
      minN: 30,
      allowWeakEvidence: false,
    });
  });

  it("balanced profile maps correctly", () => {
    expect(PROFILES.balanced).toEqual({
      minScore: 90,
      maxDrop: 2,
      warnDrop: 1,
      minN: 10,
      allowWeakEvidence: false,
    });
  });

  it("fast profile maps correctly", () => {
    expect(PROFILES.fast).toEqual({
      minScore: 85,
      maxDrop: 5,
      warnDrop: 2,
      minN: 5,
      allowWeakEvidence: true,
    });
  });
});

describe("parseArgs with --profile", () => {
  it("applies strict profile defaults when --profile strict", () => {
    const result = parseArgs(["--apiKey", "test", "--evaluationId", "42", "--profile", "strict"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.minScore).toBe(95);
      expect(result.args.maxDrop).toBe(0);
      expect(result.args.minN).toBe(30);
      expect(result.args.allowWeakEvidence).toBe(false);
    }
  });

  it("explicit --minScore overrides profile", () => {
    const result = parseArgs([
      "--apiKey",
      "test",
      "--evaluationId",
      "42",
      "--profile",
      "strict",
      "--minScore",
      "88",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.minScore).toBe(88);
      expect(result.args.maxDrop).toBe(0);
    }
  });

  it("applies balanced profile when --profile balanced", () => {
    const result = parseArgs(["--apiKey", "test", "--evaluationId", "42", "--profile", "balanced"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.minScore).toBe(90);
      expect(result.args.maxDrop).toBe(2);
      expect(result.args.minN).toBe(10);
    }
  });
});
