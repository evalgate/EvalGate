#!/usr/bin/env node
"use strict";
/**
 * evalai — EvalAI CLI
 *
 * Commands:
 *   evalai init   — Create evalai.config.json
 *   evalai check  — CI/CD evaluation gate (see evalai check --help)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const baseline_1 = require("./baseline");
const check_1 = require("./check");
const doctor_1 = require("./doctor");
const init_1 = require("./init");
const regression_gate_1 = require("./regression-gate");
const share_1 = require("./share");
const argv = process.argv.slice(2);
const subcommand = argv[0];
if (subcommand === "init") {
    const cwd = process.cwd();
    const ok = (0, init_1.runInit)(cwd);
    process.exit(ok ? 0 : 1);
}
else if (subcommand === "baseline") {
    const code = (0, baseline_1.runBaseline)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "gate") {
    const code = (0, regression_gate_1.runGate)(argv.slice(1));
    process.exit(code);
}
else if (subcommand === "doctor") {
    (0, doctor_1.runDoctor)(argv.slice(1))
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalAI ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else if (subcommand === "check") {
    const parsed = (0, check_1.parseArgs)(argv.slice(1));
    if (!parsed.ok) {
        console.error(parsed.message);
        process.exit(parsed.exitCode);
    }
    (0, check_1.runCheck)(parsed.args)
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalAI ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(4);
    });
}
else if (subcommand === "share") {
    const parsed = (0, share_1.parseShareArgs)(argv.slice(1));
    if ("error" in parsed) {
        console.error(parsed.error);
        process.exit(1);
    }
    (0, share_1.runShare)(parsed)
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalAI ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
else {
    console.log(`EvalAI CLI

Usage:
  evalai init                Create evalai.config.json
  evalai baseline init       Create starter evals/baseline.json
  evalai baseline update     Run tests and update baseline with real scores
  evalai gate [options]      Run regression gate (local test-based)
  evalai doctor [options]    Verify CI/CD setup (same endpoint as check)
  evalai check [options]     CI/CD evaluation gate (API-based)
  evalai share [options]     Create share link for a run

Options for gate:
  --format <fmt>      Output format: human (default), json, github

Options for check:
  --evaluationId <id>  Evaluation to gate on (or from config)
  --apiKey <key>      API key (or EVALAI_API_KEY env)
  --format <fmt>      Output format: human (default), json, github
  --explain           Show score breakdown and thresholds
  --onFail import     When gate fails, import run with CI context
  --minScore <n>      Fail if score < n (0-100)
  --maxDrop <n>       Fail if score dropped > n from baseline
  --warnDrop <n>      Warn (exit 8) if score dropped > n but < maxDrop
  --minN <n>          Fail if total test cases < n
  --allowWeakEvidence Allow weak evidence level
  --policy <name>     Enforce policy (HIPAA, SOC2, GDPR, etc.)
  --baseline <mode>   "published", "previous", or "production"
  --share <mode>      Share link: always | fail | never (fail = only when gate fails)
  --baseUrl <url>     API base URL

Examples:
  evalai init
  evalai check --minScore 92 --evaluationId 42 --apiKey $EVALAI_API_KEY
  evalai check --policy HIPAA --evaluationId 42 --apiKey $EVALAI_API_KEY
  evalai share --scope run --evaluationId 42 --runId 123 --expires 7d --apiKey $EVALAI_API_KEY
`);
    process.exit(subcommand === "--help" || subcommand === "-h" ? 0 : 1);
}
