#!/usr/bin/env npx tsx
/**
 * Coverage audit — enforce folder-level coverage thresholds.
 * Run after: pnpm test:coverage --run
 * Fails if a folder drops below its threshold.
 *
 * Merges coverage-final.json from all test lane subdirectories
 * (coverage/unit, coverage/db, coverage/dom) so every lane contributes.
 *
 * Risk-based thresholds (statements). Conservative floors; raise over time.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const THRESHOLDS: Record<string, number> = {
  "src/lib/scoring": 10,
  "src/lib/jobs": 10,
  "src/lib": 3,
  "src/db": 1,
  "src/app/api": 1,
  "src/packages/sdk": 1,
};

/** Subdirectories where each test lane writes coverage. */
const COVERAGE_LANES = ["unit", "db", "dom"];

type IstanbulFile = { s?: Record<string, number> };

function isTestFile(filePath: string): boolean {
  return (
    filePath.includes("/__tests__/") ||
    filePath.includes("/tests/") ||
    filePath.includes("/__mocks__/") ||
    /\.(test|spec|bench)\.[cm]?[jt]sx?$/.test(filePath)
  );
}

/**
 * Load and merge coverage-final.json from all lane subdirectories.
 * Falls back to root coverage/ if no lane subdirectories exist.
 */
function parseCoverage(): Map<string, number> {
  const coverageDir = path.join(process.cwd(), "coverage");
  if (!fs.existsSync(coverageDir)) {
    console.error("No coverage/ found. Run: pnpm test:coverage --run");
    process.exit(1);
  }

  // Collect all coverage-final.json paths (lane subdirs + root fallback)
  const finalPaths: string[] = [];
  for (const lane of COVERAGE_LANES) {
    const p = path.join(coverageDir, lane, "coverage-final.json");
    if (fs.existsSync(p)) finalPaths.push(p);
  }
  // Fallback: root coverage-final.json
  const rootFinal = path.join(coverageDir, "coverage-final.json");
  if (finalPaths.length === 0 && fs.existsSync(rootFinal)) {
    finalPaths.push(rootFinal);
  }

  if (finalPaths.length > 0) {
    return parseFinalJson(finalPaths);
  }

  // Try summary fallback (single file)
  const summaryPath = path.join(coverageDir, "coverage-summary.json");
  if (fs.existsSync(summaryPath)) {
    return parseSummaryJson(summaryPath);
  }

  // Try lane summary files
  for (const lane of COVERAGE_LANES) {
    const p = path.join(coverageDir, lane, "coverage-summary.json");
    if (fs.existsSync(p)) {
      return parseSummaryJson(p);
    }
  }

  console.error(
    "No coverage-final.json or coverage-summary.json found. Run: pnpm test:coverage --run",
  );
  process.exit(1);
}

/**
 * Merge multiple coverage-final.json files into folder-level percentages.
 * For each source file, we take the max coverage across lanes (best-effort merge).
 */
function parseFinalJson(paths: string[]): Map<string, number> {
  // Merge: for each source file, take max covered statements across lanes
  const merged = new Map<string, { covered: number; total: number }>();

  for (const p of paths) {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, IstanbulFile>;

    for (const [filePath, data] of Object.entries(raw)) {
      if (isTestFile(filePath)) continue;

      const norm = filePath.replace(/\\/g, "/");
      const statements = data.s ?? {};
      const total = Object.keys(statements).length;
      const covered = Object.values(statements).filter((v) => v > 0).length;
      if (total === 0) continue;

      const prev = merged.get(norm);
      if (!prev || covered > prev.covered) {
        merged.set(norm, { covered, total });
      }
    }
  }

  // Aggregate by threshold folder
  const byDir = new Map<string, { covered: number; total: number }>();
  for (const [norm, { covered, total }] of merged) {
    for (const folder of Object.keys(THRESHOLDS)) {
      if (norm.includes(folder)) {
        const prev = byDir.get(folder) ?? { covered: 0, total: 0 };
        byDir.set(folder, { covered: prev.covered + covered, total: prev.total + total });
        break;
      }
    }
  }

  const result = new Map<string, number>();
  for (const [folder, { covered, total }] of byDir) {
    result.set(folder, total > 0 ? (covered / total) * 100 : 100);
  }
  return result;
}

function parseSummaryJson(summaryPath: string): Map<string, number> {
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as Record<
    string,
    { statements?: { pct: number } }
  >;
  const result = new Map<string, number>();
  for (const [filePath, data] of Object.entries(summary)) {
    const norm = filePath.replace(/\\/g, "/");
    const pct = data.statements?.pct ?? 0;
    for (const folder of Object.keys(THRESHOLDS)) {
      if (norm.includes(folder)) {
        const prev = result.get(folder);
        result.set(folder, prev != null ? Math.min(prev, pct) : pct);
        break;
      }
    }
  }
  return result;
}

function main(): void {
  const coverage = parseCoverage();
  let failed = false;

  for (const [folder, threshold] of Object.entries(THRESHOLDS)) {
    const pct = coverage.get(folder);
    const pass = pct == null || pct >= threshold; // N/A = pass (no files in lane)
    const status = pass ? "✓" : "✗";
    if (!pass) failed = true;
    const pctStr = pct != null ? `${pct.toFixed(1)}%` : "N/A (no coverage data)";
    console.log(`${status} ${folder}: ${pctStr} (threshold ${threshold}%)`);
  }

  if (failed) {
    console.error("\nCoverage audit failed. One or more folders below threshold.");
    process.exit(1);
  }
  console.log("\nCoverage audit passed.");
}

main();
