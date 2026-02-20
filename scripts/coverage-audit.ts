#!/usr/bin/env npx tsx
/**
 * Coverage audit — enforce folder-level coverage thresholds.
 * Run after: pnpm test:coverage --run
 * Fails if any folder drops below its threshold.
 *
 * Risk-based thresholds (statements). Modest floors; raise over time.
 *   src/lib: 14%, src/db: 28%, src/app/api: 6%, src/packages/sdk: 39%
 *
 * Uses coverage/coverage-final.json (Istanbul) or coverage/coverage-summary.json (Vitest json-summary).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const THRESHOLDS: Record<string, number> = {
  "src/lib/scoring": 60, // quality-score + algorithms — well-tested pure functions
  "src/lib/jobs": 55, // enqueue + runner — new Phase 1 primitives
  "src/lib": 20, // overall lib floor (raised from 18)
  "src/db": 28,
  "src/app/api": 6,
  "src/packages/sdk": 39,
};

function parseCoverage(): Map<string, number> {
  const coverageDir = path.join(process.cwd(), "coverage");
  if (!fs.existsSync(coverageDir)) {
    console.error("No coverage/ found. Run: pnpm test:coverage --run");
    process.exit(1);
  }

  const finalPath = path.join(coverageDir, "coverage-final.json");
  const summaryPath = path.join(coverageDir, "coverage-summary.json");

  if (fs.existsSync(finalPath)) {
    const raw = JSON.parse(fs.readFileSync(finalPath, "utf-8")) as Record<
      string,
      { s?: Record<string, number> }
    >;
    const byDir = new Map<string, { covered: number; total: number }>();

    for (const [filePath, data] of Object.entries(raw)) {
      const norm = filePath.replace(/\\/g, "/");
      const statements = data.s ?? {};
      const total = Object.keys(statements).length;
      const covered = Object.values(statements).filter((v) => v > 0).length;
      if (total === 0) continue;

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

  if (fs.existsSync(summaryPath)) {
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

  console.error("No coverage-final.json or coverage-summary.json. Run: pnpm test:coverage --run");
  process.exit(1);
}

function main(): void {
  const coverage = parseCoverage();
  let failed = false;

  for (const [folder, threshold] of Object.entries(THRESHOLDS)) {
    const pct = coverage.get(folder);
    const status = pct != null && pct >= threshold ? "✓" : "✗";
    if (pct != null && pct < threshold) failed = true;
    const pctStr = pct != null ? `${pct.toFixed(1)}%` : "N/A (excluded or no files)";
    console.log(`${status} ${folder}: ${pctStr} (threshold ${threshold}%)`);
  }

  if (failed) {
    console.error("\nCoverage audit failed. One or more folders below threshold.");
    process.exit(1);
  }
  console.log("\nCoverage audit passed.");
}

main();
