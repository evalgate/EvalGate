/**
 * Integration test — evalai init scaffolder
 *
 * Runs runInit() against each fixture (npm, pnpm, yarn, monorepo)
 * and verifies the scaffolded files are correct.
 */
import * as fs from "node:fs";
import * as yaml from "node:module";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../../cli/init";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

/** Copy a fixture into a temp dir so we don't mutate the original */
function copyFixture(name: string, tmpDir: string): string {
  const src = path.join(FIXTURES_DIR, name);
  const dest = path.join(tmpDir, name);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
  return dest;
}

/** Parse YAML-like GitHub Actions workflow (simple key check) */
function isValidWorkflowYaml(content: string): boolean {
  return (
    content.includes("name:") &&
    content.includes("on:") &&
    content.includes("jobs:") &&
    content.includes("runs-on:")
  );
}

describe("evalai init scaffolder", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = path.join(
      process.env.TEMP || process.env.TMPDIR || "/tmp",
      `evalai-init-test-${Date.now()}`,
    );
    fs.mkdirSync(tmpRoot, { recursive: true });
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up tmp dir
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const fixtures = [
    { name: "npm-jest", expectedPm: "npm" },
    { name: "pnpm-vitest", expectedPm: "pnpm" },
    { name: "yarn-jest", expectedPm: "yarn" },
    { name: "pnpm-monorepo", expectedPm: "pnpm" },
  ];

  for (const fixture of fixtures) {
    describe(`fixture: ${fixture.name} (${fixture.expectedPm})`, () => {
      let cwd: string;

      beforeEach(() => {
        cwd = copyFixture(fixture.name, tmpRoot);
      });

      it("returns true (success)", () => {
        const result = runInit(cwd);
        expect(result).toBe(true);
      });

      it("creates evals/baseline.json", () => {
        runInit(cwd);
        const baselinePath = path.join(cwd, "evals", "baseline.json");
        expect(fs.existsSync(baselinePath)).toBe(true);

        const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
        expect(baseline.schemaVersion).toBe(1);
        expect(typeof baseline.generatedAt).toBe("string");
        expect(typeof baseline.generatedBy).toBe("string");
        expect(baseline.tolerance).toBeDefined();
        expect(baseline.confidenceTests).toBeDefined();
      });

      it("creates .github/workflows/evalai-gate.yml with valid YAML", () => {
        runInit(cwd);
        const workflowPath = path.join(cwd, ".github", "workflows", "evalai-gate.yml");
        expect(fs.existsSync(workflowPath)).toBe(true);

        const content = fs.readFileSync(workflowPath, "utf-8");
        expect(isValidWorkflowYaml(content)).toBe(true);
        expect(content).toContain("npx -y @pauly4010/evalai-sdk@^1 gate --format github");
        expect(content).toContain("regression-report");
      });

      it("creates evalai.config.json", () => {
        runInit(cwd);
        const configPath = path.join(cwd, "evalai.config.json");
        expect(fs.existsSync(configPath)).toBe(true);

        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        expect(config.gate).toBeDefined();
        expect(config.gate.baseline).toBe("evals/baseline.json");
        expect(config.gate.report).toBe("evals/regression-report.json");
      });

      it("workflow uses correct package manager", () => {
        runInit(cwd);
        const workflowPath = path.join(cwd, ".github", "workflows", "evalai-gate.yml");
        const content = fs.readFileSync(workflowPath, "utf-8");

        if (fixture.expectedPm === "pnpm") {
          expect(content).toContain("pnpm/action-setup");
          expect(content).toContain("pnpm install --frozen-lockfile");
        } else if (fixture.expectedPm === "yarn") {
          expect(content).toContain("cache: yarn");
          expect(content).toContain("yarn install --frozen-lockfile");
        } else {
          expect(content).toContain("cache: npm");
          expect(content).toContain("npm ci");
        }
      });

      it("is idempotent (skips existing files on second run)", () => {
        runInit(cwd);

        // Get file contents after first run
        const baselineBefore = fs.readFileSync(path.join(cwd, "evals", "baseline.json"), "utf-8");

        // Run again
        const result = runInit(cwd);
        expect(result).toBe(true);

        // baseline.json should not be overwritten
        const baselineAfter = fs.readFileSync(path.join(cwd, "evals", "baseline.json"), "utf-8");
        expect(baselineAfter).toBe(baselineBefore);
      });
    });
  }

  it("returns false when no package.json exists", () => {
    const emptyDir = path.join(tmpRoot, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    const result = runInit(emptyDir);
    expect(result).toBe(false);
  });
});
