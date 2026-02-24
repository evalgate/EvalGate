"use strict";
/**
 * evalai baseline — Baseline management commands
 *
 * Subcommands:
 *   evalai baseline init    — Create a starter evals/baseline.json
 *   evalai baseline update  — Run tests + update baseline with real scores
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBaselineInit = runBaselineInit;
exports.runBaselineUpdate = runBaselineUpdate;
exports.runBaseline = runBaseline;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const BASELINE_REL = "evals/baseline.json";
/** Detect the package manager used in the project */
function detectPackageManager(cwd) {
    if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml")))
        return "pnpm";
    if (fs.existsSync(path.join(cwd, "yarn.lock")))
        return "yarn";
    return "npm";
}
/** Run an npm script via the detected package manager */
function runScript(cwd, scriptName) {
    const pm = detectPackageManager(cwd);
    const isWin = process.platform === "win32";
    const result = (0, node_child_process_1.spawnSync)(pm, ["run", scriptName], {
        cwd,
        stdio: "inherit",
        shell: isWin,
    });
    return result.status ?? 1;
}
function runBaselineInit(cwd) {
    const baselinePath = path.join(cwd, BASELINE_REL);
    if (fs.existsSync(baselinePath)) {
        console.log(`⚠ ${BASELINE_REL} already exists. Delete it first or use 'evalai baseline update'.`);
        return 1;
    }
    // Ensure evals/ directory exists
    const evalsDir = path.join(cwd, "evals");
    if (!fs.existsSync(evalsDir)) {
        fs.mkdirSync(evalsDir, { recursive: true });
    }
    const user = process.env.USER || process.env.USERNAME || "unknown";
    const now = new Date().toISOString();
    const baseline = {
        schemaVersion: 1,
        description: "Regression gate baseline — created by evalai baseline init",
        generatedAt: now,
        generatedBy: user,
        commitSha: "0000000",
        updatedAt: now,
        updatedBy: user,
        tolerance: {
            scoreDrop: 5,
            passRateDrop: 5,
            maxLatencyIncreaseMs: 200,
            maxCostIncreaseUsd: 0.05,
        },
        goldenEval: {
            score: 100,
            passRate: 100,
            totalCases: 3,
            passedCases: 3,
        },
        qualityScore: {
            overall: 90,
            grade: "A",
            accuracy: 85,
            safety: 100,
            latency: 90,
            cost: 90,
            consistency: 90,
        },
        confidenceTests: {
            unitPassed: true,
            unitTotal: 0,
            dbPassed: true,
            dbTotal: 0,
        },
        productMetrics: {},
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`✅ Created ${BASELINE_REL} with sample values\n`);
    console.log("Next steps:");
    console.log(`  1. Commit ${BASELINE_REL} to your repo`);
    console.log("  2. Run 'evalai baseline update' to populate with real scores");
    console.log("  3. Run 'evalai gate' to verify the regression gate\n");
    return 0;
}
// ── baseline update ──
function runBaselineUpdate(cwd) {
    // Check if eval:baseline-update script exists in package.json
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        console.error("❌ No package.json found. Run this from your project root.");
        return 1;
    }
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    }
    catch {
        console.error("❌ Failed to parse package.json");
        return 1;
    }
    if (!pkg.scripts?.["eval:baseline-update"]) {
        console.error("❌ Missing 'eval:baseline-update' script in package.json.");
        console.error("   Add it:  \"eval:baseline-update\": \"npx tsx scripts/regression-gate.ts --update-baseline\"");
        return 1;
    }
    console.log("📊 Running baseline update...\n");
    return runScript(cwd, "eval:baseline-update");
}
// ── baseline router ──
function runBaseline(argv) {
    const sub = argv[0];
    const cwd = process.cwd();
    if (sub === "init") {
        return runBaselineInit(cwd);
    }
    if (sub === "update") {
        return runBaselineUpdate(cwd);
    }
    console.log(`evalai baseline — Manage regression gate baselines

Usage:
  evalai baseline init     Create starter ${BASELINE_REL}
  evalai baseline update   Run tests and update baseline with real scores

Examples:
  evalai baseline init
  evalai baseline update
`);
    return sub === "--help" || sub === "-h" ? 0 : 1;
}
