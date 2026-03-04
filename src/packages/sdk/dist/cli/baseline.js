"use strict";
/**
 * evalai baseline — Baseline management commands
 *
 * Subcommands:
 *   evalgate baseline init    — Create a starter evals/baseline.json
 *   evalgate baseline update  — Run tests + update baseline with real scores
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
exports.computeBaselineChecksum = computeBaselineChecksum;
exports.verifyBaselineChecksum = verifyBaselineChecksum;
exports.runBaselineInit = runBaselineInit;
exports.runBaselineUpdate = runBaselineUpdate;
exports.runBaseline = runBaseline;
const node_child_process_1 = require("node:child_process");
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Compute a SHA-256 checksum of the baseline data (excluding the _checksum field).
 * This detects accidental corruption or manual tampering between runs.
 */
function computeBaselineChecksum(data) {
    const copy = { ...data };
    delete copy._checksum;
    const content = JSON.stringify(copy, Object.keys(copy).sort());
    return crypto.createHash("sha256").update(content).digest("hex");
}
/**
 * Verify the checksum stored in a baseline file matches its content.
 * Returns { valid: true } if checksum matches or is absent (legacy files).
 * Returns { valid: false, reason } if checksum is present but doesn't match.
 */
function verifyBaselineChecksum(data) {
    const stored = data._checksum;
    if (typeof stored !== "string") {
        // Legacy baseline without checksum — allow but warn
        return { valid: true, reason: "no_checksum" };
    }
    const computed = computeBaselineChecksum(data);
    if (computed !== stored) {
        return {
            valid: false,
            reason: `Checksum mismatch: expected ${stored.slice(0, 12)}…, got ${computed.slice(0, 12)}…. Baseline may be corrupted or tampered with.`,
        };
    }
    return { valid: true };
}
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
        console.log(`⚠ ${BASELINE_REL} already exists. Delete it first or use 'evalgate baseline update'.`);
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
        description: "Regression gate baseline — created by evalgate baseline init",
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
    // Stamp checksum
    const withChecksum = {
        ...baseline,
        _checksum: computeBaselineChecksum(baseline),
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(withChecksum, null, 2)}\n`);
    console.log(`✅ Created ${BASELINE_REL} with sample values (checksum stamped)\n`);
    console.log("Next steps:");
    console.log(`  1. Commit ${BASELINE_REL} to your repo`);
    console.log("  2. Run 'evalgate baseline update' to populate with real scores");
    console.log("  3. Run 'evalgate gate' to verify the regression gate\n");
    return 0;
}
// ── baseline update ──
function runBaselineUpdate(cwd) {
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
    // Use custom script if available
    if (pkg.scripts?.["eval:baseline-update"]) {
        console.log("📊 Running baseline update (custom script)...\n");
        return runScript(cwd, "eval:baseline-update");
    }
    // Self-contained built-in mode: run the test suite then stamp the baseline
    console.log("📊 Running baseline update (built-in mode)...\n");
    const pm = detectPackageManager(cwd);
    const isWin = process.platform === "win32";
    const testResult = (0, node_child_process_1.spawnSync)(pm, ["test"], {
        cwd,
        stdio: "inherit",
        shell: isWin,
    });
    const baselinePath = path.join(cwd, BASELINE_REL);
    if (!fs.existsSync(baselinePath)) {
        console.error("❌ No baseline found. Run 'evalgate baseline init' first.");
        return 1;
    }
    try {
        const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
        baseline.updatedAt = new Date().toISOString();
        baseline.updatedBy = process.env.USER || process.env.USERNAME || "unknown";
        baseline.confidenceTests = baseline.confidenceTests ?? {};
        baseline.confidenceTests.unitPassed = testResult.status === 0;
        // Re-stamp checksum
        baseline._checksum = computeBaselineChecksum(baseline);
        fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
        console.log("\n✅ Baseline updated successfully (checksum stamped)");
    }
    catch {
        console.error("❌ Failed to update baseline file");
        return 1;
    }
    return testResult.status ?? 1;
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
  evalgate baseline init     Create starter ${BASELINE_REL}
  evalgate baseline update   Run tests and update baseline with real scores

Examples:
  evalgate baseline init
  evalgate baseline update
`);
    return sub === "--help" || sub === "-h" ? 0 : 1;
}
