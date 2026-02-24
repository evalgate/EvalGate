#!/usr/bin/env npx tsx
/**
 * Index Audit — verify that every high-volume query column has a covering index.
 *
 * Reads the Drizzle migration SQL files and checks that each required index
 * exists. Exits 1 if unknown required index is missing (CI gate).
 *
 * Run: npx tsx scripts/index-audit.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Each entry: { table, column, reason } — must have at least one index covering the column */
const REQUIRED_INDEXES: Array<{ table: string; column: string; reason: string }> = [
  // SLO endpoint — rolling 24h window queries
  { table: "api_usage_logs", column: "created_at", reason: "SLO p95 latency window scan" },
  {
    table: "webhook_deliveries",
    column: "created_at",
    reason: "SLO webhook success rate window scan",
  },
  { table: "quality_scores", column: "created_at", reason: "SLO eval gate pass rate window scan" },

  // Integer timestamp indexes added in 0035
  {
    table: "api_usage_logs",
    column: "created_at_int",
    reason: "Phase 3-A integer timestamp index",
  },
  {
    table: "webhook_deliveries",
    column: "created_at_int",
    reason: "Phase 3-A integer timestamp index",
  },
  { table: "test_results", column: "created_at_int", reason: "Phase 3-A integer timestamp index" },
  { table: "spans", column: "created_at_int", reason: "Phase 3-A integer timestamp index" },
  {
    table: "quality_scores",
    column: "created_at_int",
    reason: "Phase 3-A integer timestamp index",
  },

  // Job runner — status + next_run_at composite
  { table: "jobs", column: "status", reason: "Job runner due-job scan" },
  { table: "jobs", column: "next_run_at", reason: "Job runner due-job scan" },

  // Hot join paths
  { table: "test_results", column: "evaluation_run_id", reason: "Aggregate metrics join" },
  { table: "llm_judge_results", column: "evaluation_run_id", reason: "Judge avg join" },
  { table: "cost_records", column: "evaluation_run_id", reason: "Cost aggregate join" },
  { table: "quality_scores", column: "evaluation_run_id", reason: "Quality score lookup" },
  { table: "webhook_deliveries", column: "webhook_id", reason: "Delivery history lookup" },
];

/** Collect all CREATE INDEX statements from all migration SQL files */
function collectIndexedColumns(): Map<string, Set<string>> {
  const drizzleDir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(drizzleDir)) {
    console.error("drizzle/ directory not found");
    process.exit(1);
  }

  // table → set of indexed columns
  const indexed = new Map<string, Set<string>>();

  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(drizzleDir, file), "utf-8");

    // Match: CREATE [UNIQUE] INDEX [IF NOT EXISTS] ... ON `table` (`col1`, `col2`, ...)
    const indexRe =
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\S+\s+ON\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/gi;
    let m: RegExpExecArray | null = indexRe.exec(content);
    while (m !== null) {
      const table = m[1].toLowerCase();
      const cols = m[2].split(",").map((c) => c.trim().replace(/[`"]/g, "").toLowerCase());
      if (!indexed.has(table)) indexed.set(table, new Set());
      for (const col of cols) indexed.get(table)!.add(col);
      m = indexRe.exec(content);
    }

    // Also match inline index definitions in CREATE TABLE (e.g. PRIMARY KEY, UNIQUE)
    // These don't need to be in REQUIRED_INDEXES but good to capture for completeness
  }

  return indexed;
}

function main(): void {
  const indexed = collectIndexedColumns();
  let failed = false;

  console.log("Index Audit\n");
  console.log(`${"Table".padEnd(25)} ${"Column".padEnd(25)} ${"Status".padEnd(8)} Reason`);
  console.log("─".repeat(90));

  for (const { table, column, reason } of REQUIRED_INDEXES) {
    const cols = indexed.get(table.toLowerCase());
    const found = cols?.has(column.toLowerCase()) ?? false;
    const status = found ? "✓" : "✗ MISSING";
    if (!found) failed = true;
    console.log(`${table.padEnd(25)} ${column.padEnd(25)} ${status.padEnd(8)} ${reason}`);
  }

  console.log();
  if (failed) {
    console.error("Index audit FAILED — add missing indexes in a new migration.");
    process.exit(1);
  }
  console.log("Index audit passed.");
}

main();
