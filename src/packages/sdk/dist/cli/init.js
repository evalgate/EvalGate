#!/usr/bin/env node
"use strict";
/**
 * evalgate init — Full project scaffolder
 *
 * Zero-to-gate in under 5 minutes:
 *   npx evalgate init
 *   git push
 *   …CI starts blocking regressions.
 *
 * What it does:
 *   1. Detects Node repo + package manager
 *   2. Creates evals/ directory + baseline.json
 *   3. Installs .github/workflows/evalgate-gate.yml
 *   4. Prints next steps (no docs required)
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
exports.runInit = runInit;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function detectProject(cwd) {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath))
        return null;
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    }
    catch {
        return null;
    }
    let pm = "npm";
    if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml")))
        pm = "pnpm";
    else if (fs.existsSync(path.join(cwd, "yarn.lock")))
        pm = "yarn";
    const testScript = pkg.scripts?.test ?? "";
    const hasTestScript = !!testScript && testScript !== 'echo "Error: no test specified" && exit 1';
    return {
        cwd,
        pm,
        hasTestScript,
        testScript,
        name: pkg.name ?? path.basename(cwd),
    };
}
// ── Step helpers ──
function ok(msg) {
    console.log(`  ✔ ${msg}`);
}
function skip(msg) {
    console.log(`  – ${msg}`);
}
function warn(msg) {
    console.log(`  ⚠ ${msg}`);
}
// ── 1. Create evals/ + baseline.json ──
function createBaseline(cwd, project) {
    const evalsDir = path.join(cwd, "evals");
    const baselinePath = path.join(evalsDir, "baseline.json");
    if (fs.existsSync(baselinePath)) {
        skip("evals/baseline.json already exists");
        return true;
    }
    if (!fs.existsSync(evalsDir)) {
        fs.mkdirSync(evalsDir, { recursive: true });
    }
    const user = process.env.USER || process.env.USERNAME || "unknown";
    const now = new Date().toISOString();
    // Run tests to capture real count if possible
    let testTotal = 0;
    let testsPassed = true;
    if (project.hasTestScript) {
        const isWin = process.platform === "win32";
        const result = (0, node_child_process_1.spawnSync)(project.pm, ["test"], {
            cwd,
            stdio: "pipe",
            shell: isWin,
            timeout: 120000,
        });
        testsPassed = result.status === 0;
        // Try to extract test count from output
        const output = (result.stdout?.toString() ?? "") + (result.stderr?.toString() ?? "");
        const countMatch = output.match(/(\d+)\s+(?:tests?|specs?)\s+(?:passed|completed)/i) ??
            output.match(/Tests:\s+(\d+)\s+passed/i) ??
            output.match(/(\d+)\s+passing/i);
        if (countMatch)
            testTotal = parseInt(countMatch[1], 10);
    }
    const baseline = {
        schemaVersion: 1,
        description: `Regression gate baseline for ${project.name}`,
        generatedAt: now,
        generatedBy: user,
        commitSha: getHeadSha(cwd),
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
        confidenceTests: {
            passed: testsPassed,
            total: testTotal,
        },
        productMetrics: {},
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    ok("Created evals/baseline.json");
    return true;
}
function getHeadSha(cwd) {
    try {
        const result = (0, node_child_process_1.spawnSync)("git", ["rev-parse", "--short", "HEAD"], {
            cwd,
            stdio: "pipe",
        });
        return result.stdout?.toString().trim() || "0000000";
    }
    catch {
        return "0000000";
    }
}
// ── 2. Install GitHub Actions workflow ──
function installWorkflow(cwd, project) {
    const workflowDir = path.join(cwd, ".github", "workflows");
    const workflowPath = path.join(workflowDir, "evalgate-gate.yml");
    if (fs.existsSync(workflowPath)) {
        skip(".github/workflows/evalgate-gate.yml already exists");
        return true;
    }
    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    const installCmd = project.pm === "pnpm"
        ? "pnpm install --frozen-lockfile"
        : project.pm === "yarn"
            ? "yarn install --frozen-lockfile"
            : "npm ci";
    const setupSteps = project.pm === "pnpm"
        ? `      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: pnpm
      - run: ${installCmd}`
        : `      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: ${project.pm}
      - run: ${installCmd}`;
    const workflow = `# EvalGate Regression Gate
# Auto-generated by: npx evalgate init
# Blocks PRs that regress test health.
name: EvalGate Gate

on:
  pull_request:
    branches: [main]

concurrency:
  group: evalgate-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  regression-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setupSteps}
      - name: EvalGate Doctor (preflight)
        continue-on-error: true  # Strict: set to false, or use: evalgate doctor --strict
        run: npx -y @evalgate/sdk@^2 doctor

      - name: EvalGate Regression Gate
        run: npx -y @evalgate/sdk@^2 gate --format github

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evalgate-report
          path: |
            evals/regression-report.json
            .evalgate/last-report.json
          if-no-files-found: ignore
`;
    fs.writeFileSync(workflowPath, workflow);
    ok("Created .github/workflows/evalgate-gate.yml");
    return true;
}
// ── 3. Copy evalgate.md ──
function copyEvalgateMd(cwd) {
    const sourcePath = path.join(__dirname, "..", "..", "..", "..", "..", "evalgate.md");
    const targetPath = path.join(cwd, "evalgate.md");
    if (!fs.existsSync(sourcePath)) {
        // If evalgate.md is not found in the expected location, skip silently
        // This can happen in development or when the package is installed differently
        return false;
    }
    try {
        const content = fs.readFileSync(sourcePath, "utf-8");
        fs.writeFileSync(targetPath, content, "utf-8");
        ok("Created evalgate.md");
        return true;
    }
    catch (_error) {
        warn("Could not copy evalgate.md (continuing without it)");
        return false;
    }
}
// ── 4. Create evalgate.config.json ──
function createConfig(cwd) {
    const configPath = path.join(cwd, "evalgate.config.json");
    if (fs.existsSync(configPath)) {
        skip("evalgate.config.json already exists");
        return true;
    }
    const config = {
        evaluationId: "",
        gate: {
            baseline: "evals/baseline.json",
            report: "evals/regression-report.json",
        },
    };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    ok("Created evalgate.config.json");
    return true;
}
// ── Main ──
function runInit(cwd = process.cwd()) {
    console.log("");
    console.log("  evalgate init — setting up regression gate\n");
    // Detect
    const project = detectProject(cwd);
    if (!project) {
        console.error("  ✖ No package.json found. Run this from a Node.js project root.");
        return false;
    }
    ok(`Detected ${project.pm} project: ${project.name}`);
    if (!project.hasTestScript) {
        console.log(`  ⚠ No test script found in package.json`);
        console.log(`    The gate will still work — add a "test" script later for full coverage.\n`);
    }
    // Scaffold
    createBaseline(cwd, project);
    installWorkflow(cwd, project);
    copyEvalgateMd(cwd);
    createConfig(cwd);
    // Next steps
    console.log("");
    console.log("  Done! Next:");
    console.log("");
    console.log("    npx evalgate doctor             Verify your setup is complete");
    console.log("    cat evalgate.md                 Read the unified usage guide");
    console.log("");
    console.log("  Then commit:");
    console.log("");
    console.log("    git add evals/ .github/workflows/evalgate-gate.yml evalgate.config.json evalgate.md");
    console.log("    git commit -m 'chore: add EvalGate regression gate'");
    console.log("    git push");
    console.log("");
    console.log("  That's it. Open a PR and the gate runs automatically.");
    console.log("");
    console.log("  Commands:");
    console.log("    npx evalgate doctor             Preflight check — verify config, baseline, CI");
    console.log("    npx evalgate gate               Run regression gate locally");
    console.log("    npx evalgate check              API-based gate (requires account)");
    console.log("    npx evalgate label              Label traces to build golden dataset");
    console.log("    npx evalgate analyze            Analyze failure modes from labeled data");
    console.log("    npx evalgate explain            Explain last failure with root causes + fixes");
    console.log("    npx evalgate baseline update    Update baseline after intentional changes");
    console.log("");
    console.log("  To remove: delete evals/, evalgate.config.json, evalgate.md, and .github/workflows/evalgate-gate.yml");
    console.log("");
    return true;
}
