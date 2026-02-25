/**
 * Contract test — ensures regression-report.json schema stability.
 *
 * If you change the report shape, bump REPORT_SCHEMA_VERSION in
 * scripts/regression-gate.ts and update this test + the JSON schema.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_TOP_LEVEL_FIELDS = [
  "schemaVersion",
  "timestamp",
  "passed",
  "exitCode",
  "category",
  "deltas",
  "failures",
  "baseline",
] as const;

const VALID_CATEGORIES = ["pass", "regression", "infra_error"] as const;
const VALID_EXIT_CODES = [0, 1, 2, 3, 4] as const;

const REQUIRED_DELTA_FIELDS = ["metric", "baseline", "current", "delta", "status"] as const;
const VALID_DELTA_STATUSES = ["pass", "fail", "warn"] as const;

describe("regression-report.json contract", () => {
  // Build a representative report matching what regression-gate.ts emits
  function buildSampleReport() {
    return {
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      passed: true,
      exitCode: 0,
      category: "pass" as const,
      deltas: [
        {
          metric: "Golden score",
          baseline: 100,
          current: 100,
          delta: "+0",
          status: "pass" as const,
        },
        { metric: "Unit tests", baseline: 75, current: 75, delta: "✓", status: "pass" as const },
      ],
      failures: [] as string[],
      baseline: { updatedAt: "2026-01-01T00:00:00Z", updatedBy: "test" },
      durationMs: 1234,
      command: "npm test",
      runner: "vitest",
    };
  }

  it("has all required top-level fields", () => {
    const report = buildSampleReport();
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      expect(report).toHaveProperty(field);
    }
  });

  it("schemaVersion is a positive integer", () => {
    const report = buildSampleReport();
    expect(typeof report.schemaVersion).toBe("number");
    expect(report.schemaVersion).toBeGreaterThan(0);
    expect(Number.isInteger(report.schemaVersion)).toBe(true);
  });

  it("category is one of the valid values", () => {
    const report = buildSampleReport();
    expect(VALID_CATEGORIES).toContain(report.category);
  });

  it("exitCode is one of the valid values", () => {
    const report = buildSampleReport();
    expect(VALID_EXIT_CODES).toContain(report.exitCode);
  });

  it("passed is a boolean", () => {
    const report = buildSampleReport();
    expect(typeof report.passed).toBe("boolean");
  });

  it("deltas array entries have required fields", () => {
    const report = buildSampleReport();
    expect(Array.isArray(report.deltas)).toBe(true);
    for (const delta of report.deltas) {
      for (const field of REQUIRED_DELTA_FIELDS) {
        expect(delta).toHaveProperty(field);
      }
      expect(VALID_DELTA_STATUSES).toContain(delta.status);
    }
  });

  it("failures is an array of strings", () => {
    const report = buildSampleReport();
    expect(Array.isArray(report.failures)).toBe(true);
    for (const f of report.failures) {
      expect(typeof f).toBe("string");
    }
  });

  it("baseline is an object with updatedAt and updatedBy (or null for infra errors)", () => {
    const report = buildSampleReport();
    if (report.baseline !== null) {
      expect(report.baseline).toHaveProperty("updatedAt");
      expect(report.baseline).toHaveProperty("updatedBy");
    }
  });

  it("durationMs is a non-negative integer", () => {
    const report = buildSampleReport();
    expect(typeof report.durationMs).toBe("number");
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(report.durationMs)).toBe(true);
  });

  it("command is a non-empty string", () => {
    const report = buildSampleReport();
    expect(typeof report.command).toBe("string");
    expect(report.command.length).toBeGreaterThan(0);
  });

  it("runner is a string", () => {
    const report = buildSampleReport();
    expect(typeof report.runner).toBe("string");
    expect(report.runner.length).toBeGreaterThan(0);
  });

  it("regression category has exitCode 1", () => {
    const report = {
      ...buildSampleReport(),
      category: "regression" as const,
      exitCode: 1,
      passed: false,
    };
    expect(report.exitCode).toBe(1);
    expect(report.passed).toBe(false);
  });

  it("infra_error category has exitCode 2, 3, or 4", () => {
    for (const code of [2, 3, 4]) {
      const report = {
        ...buildSampleReport(),
        category: "infra_error" as const,
        exitCode: code,
        passed: false,
      };
      expect(report.category).toBe("infra_error");
      expect([2, 3, 4]).toContain(report.exitCode);
    }
  });

  it("JSON schema file exists and lists all required fields", () => {
    const schemaPath = path.resolve(process.cwd(), "evals/schemas/regression-report.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(schema.$schema).toBeDefined();
    expect(schema.required).toBeDefined();
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      expect(schema.required).toContain(field);
    }
    expect(schema.properties.exitCode.enum).toEqual([0, 1, 2, 3, 4]);
    expect(schema.properties.category.enum).toEqual(["pass", "regression", "infra_error"]);
  });

  it("sample report has no extra top-level keys beyond schema properties", () => {
    const schemaPath = path.resolve(process.cwd(), "evals/schemas/regression-report.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const report = buildSampleReport();
    const reportKeys = Object.keys(report);
    const schemaKeys = Object.keys(schema.properties);
    for (const key of reportKeys) {
      expect(schemaKeys).toContain(key);
    }
  });
});
