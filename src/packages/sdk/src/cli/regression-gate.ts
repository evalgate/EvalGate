/**
 * evalai gate — Run the regression gate
 *
 * Delegates to the project's eval:regression-gate npm script.
 * Supports --format json to output the regression-report.json contents.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPORT_REL = "evals/regression-report.json";

/** Detect the package manager used in the project */
function detectPackageManager(cwd: string): string {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

export interface GateArgs {
  format: "human" | "json" | "github";
}

export function parseGateArgs(argv: string[]): GateArgs {
  const args: GateArgs = { format: "human" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format" && argv[i + 1]) {
      const fmt = argv[i + 1];
      if (fmt === "json" || fmt === "github" || fmt === "human") {
        args.format = fmt;
      }
      i++;
    }
  }
  return args;
}

export function runGate(argv: string[]): number {
  const cwd = process.cwd();
  const args = parseGateArgs(argv);

  // Check if eval:regression-gate script exists
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("❌ No package.json found. Run this from your project root.");
    return 1;
  }

  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    console.error("❌ Failed to parse package.json");
    return 1;
  }

  if (!pkg.scripts?.["eval:regression-gate"]) {
    console.error("❌ Missing 'eval:regression-gate' script in package.json.");
    console.error('   Add it:  "eval:regression-gate": "npx tsx scripts/regression-gate.ts"');
    return 1;
  }

  const pm = detectPackageManager(cwd);
  const isWin = process.platform === "win32";

  // For json format, suppress human output and print report JSON
  const stdio = args.format === "json" ? "pipe" : "inherit";

  const result = spawnSync(pm, ["run", "eval:regression-gate"], {
    cwd,
    stdio: stdio as "inherit" | "pipe",
    shell: isWin,
  });

  const exitCode = result.status ?? 1;

  if (args.format === "json") {
    // Output the regression report as JSON
    const reportPath = path.join(cwd, REPORT_REL);
    if (fs.existsSync(reportPath)) {
      const report = fs.readFileSync(reportPath, "utf-8");
      process.stdout.write(report);
    } else {
      console.error(JSON.stringify({ error: "regression-report.json not found", exitCode }));
    }
  } else if (args.format === "github") {
    // Output GitHub Step Summary markdown
    const reportPath = path.join(cwd, REPORT_REL);
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
        const icon = report.passed ? "✅" : "❌";
        const lines = [
          `## ${icon} Regression Gate: ${report.category}`,
          "",
          "| Metric | Baseline | Current | Delta | Status |",
          "|--------|----------|---------|-------|--------|",
        ];
        for (const d of report.deltas ?? []) {
          const statusIcon = d.status === "pass" ? "✅" : "❌";
          lines.push(`| ${d.metric} | ${d.baseline} | ${d.current} | ${d.delta} | ${statusIcon} |`);
        }
        if (report.failures?.length > 0) {
          lines.push("", "### Failures", "");
          for (const f of report.failures) {
            lines.push(`- ${f}`);
          }
        }
        lines.push("", `Schema version: ${report.schemaVersion ?? "unknown"}`);
        const md = lines.join("\n");

        // Write to $GITHUB_STEP_SUMMARY if available
        const summaryPath = process.env.GITHUB_STEP_SUMMARY;
        if (summaryPath) {
          fs.appendFileSync(summaryPath, `${md}\n`);
        }
        console.log(md);
      } catch {
        // Fall through — human output already printed
      }
    }
  }

  return exitCode;
}
