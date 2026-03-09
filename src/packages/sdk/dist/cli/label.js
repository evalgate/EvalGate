"use strict";
/**
 * evalgate label — Interactive trace labeling for golden dataset.
 *
 * Steps through traces from a run result, allowing pass/fail labeling
 * and optional failure-mode tagging. Writes to canonical labeled.jsonl.
 *
 * Usage:
 *   evalgate label                             # label latest run
 *   evalgate label --run path/to/run.json      # label specific run
 *   evalgate label --output path/to/labeled.jsonl
 *   evalgate label --format human|json
 *
 * Exit codes:
 *   0 — Completed successfully
 *   1 — Input file not found or invalid
 *   2 — Output write error
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
exports.parseLabelArgs = parseLabelArgs;
exports.runLabel = runLabel;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const readline = __importStar(require("node:readline"));
const run_1 = require("./run");
// Standard failure modes - can be extended via config later
const STANDARD_FAILURE_MODES = [
    "constraint_missing",
    "tone_mismatch",
    "hallucination",
    "invalid_tool_call",
    "retrieval_error",
    "format_error",
    "safety_violation",
    "logic_error",
    "incomplete_response",
    "other",
];
function parseLabelArgs(args) {
    const result = {
        runPath: null,
        outputPath: null,
        format: "human",
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--run" && args[i + 1]) {
            result.runPath = args[++i];
        }
        else if (arg === "--output" && args[i + 1]) {
            result.outputPath = args[++i];
        }
        else if (arg === "--format" && args[i + 1]) {
            const fmt = args[++i];
            if (fmt === "json" || fmt === "human") {
                result.format = fmt;
            }
        }
    }
    return result;
}
// ── Run discovery ──
const RUN_SEARCH_PATHS = [
    "evals/latest-run.json",
    "evals/runs/latest.json",
    ".evalgate/latest-run.json",
    ".evalgate/runs/latest.json",
];
function findRunResult(cwd, explicitPath) {
    if (explicitPath) {
        const abs = path.isAbsolute(explicitPath)
            ? explicitPath
            : path.join(cwd, explicitPath);
        return fs.existsSync(abs) ? abs : null;
    }
    for (const rel of RUN_SEARCH_PATHS) {
        const abs = path.join(cwd, rel);
        if (fs.existsSync(abs))
            return abs;
    }
    return null;
}
// ── Resume support ──
function loadExistingLabeledCases(outputPath) {
    if (!fs.existsSync(outputPath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(outputPath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim().length > 0);
        return lines.map((line, i) => {
            try {
                return JSON.parse(line);
            }
            catch {
                throw new Error(`Invalid JSONL at line ${i + 1}: ${line}`);
            }
        });
    }
    catch (error) {
        throw new Error(`Failed to read existing labeled cases: ${error}`);
    }
}
function findNextIndex(runResult, existing) {
    const existingCaseIds = new Set(existing.map((c) => c.caseId));
    for (let i = 0; i < runResult.results.length; i++) {
        if (!existingCaseIds.has(runResult.results[i].specId)) {
            return i;
        }
    }
    return runResult.results.length; // All cases already labeled
}
// ── Core labeling logic ──
function createLabeledCase(spec, label, failureMode) {
    return {
        caseId: spec.specId,
        input: spec.input ?? "",
        expected: spec.expected ?? "",
        actual: spec.actual ?? "",
        label,
        failureMode,
        labeledAt: new Date().toISOString(),
    };
}
async function promptUser(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}
async function promptFailureMode(rl) {
    console.log("\n  Failure mode:");
    STANDARD_FAILURE_MODES.forEach((mode, i) => {
        console.log(`    ${i + 1}) ${mode}`);
    });
    while (true) {
        const answer = (await promptUser(rl, "  Select number: ")).trim();
        const index = parseInt(answer, 10) - 1;
        if (index >= 0 && index < STANDARD_FAILURE_MODES.length) {
            return STANDARD_FAILURE_MODES[index];
        }
        console.log("  ⚠️  Invalid selection. Please choose a number from the list.");
    }
}
function printSessionSummary(labeled) {
    const passCount = labeled.filter((c) => c.label === "pass").length;
    const failCount = labeled.filter((c) => c.label === "fail").length;
    const failureModeCounts = new Map();
    for (const c of labeled) {
        if (c.label === "fail" && c.failureMode) {
            failureModeCounts.set(c.failureMode, (failureModeCounts.get(c.failureMode) || 0) + 1);
        }
    }
    const failureModesList = Array.from(failureModeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([mode, count]) => `${mode} ×${count}`)
        .join(", ");
    console.log(`\nSession complete: ${labeled.length} labeled (${passCount} pass, ${failCount} fail)`);
    if (failureModesList) {
        console.log(`Failure modes: ${failureModesList}`);
    }
}
async function labelInteractive(runResult, outputPath) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    // Resume support
    const existing = loadExistingLabeledCases(outputPath);
    const startIndex = findNextIndex(runResult, existing);
    const total = runResult.results.length;
    if (startIndex > 0) {
        console.log(`\n🔄 Resuming from case ${startIndex + 1}/${total}`);
        console.log(`   Already labeled: ${existing.length} cases`);
    }
    else {
        console.log(`\n🏷️  EvalGate Label — ${total} cases to label\n`);
    }
    console.log("Controls: p=pass, f=fail, u=undo, q=quit, ?=help\n");
    const labeled = [...existing];
    let currentIndex = startIndex;
    while (currentIndex < total) {
        const spec = runResult.results[currentIndex];
        const idx = (currentIndex + 1).toString().padStart(3, " ");
        console.log(`\n🔍 Case ${idx}/${total}: ${spec.specId}`);
        const specInput = spec.input ?? "";
        const specExpected = spec.expected ?? "";
        const specActual = spec.actual ?? "";
        console.log(`📝 Input: ${specInput.slice(0, 200)}${specInput.length > 200 ? "..." : ""}`);
        console.log(`✅ Expected: ${specExpected.slice(0, 200)}${specExpected.length > 200 ? "..." : ""}`);
        console.log(`🤖 Actual: ${specActual.slice(0, 200) || "(none)"}${specActual.length > 200 ? "..." : ""}`);
        let label = null;
        let failureMode = null;
        while (!label) {
            const answer = (await promptUser(rl, "Label? [p]ass/[f]ail/[u]ndo/[q]uit/[?]help: "))
                .trim()
                .toLowerCase();
            if (answer === "q") {
                printSessionSummary(labeled);
                console.log(`\nSaved → ${path.relative(process.cwd(), outputPath)}`);
                rl.close();
                process.exit(0);
            }
            else if (answer === "u") {
                if (labeled.length > existing.length) {
                    // Undo the last label
                    const undone = labeled.pop();
                    console.log(`  ↩️  Undid: ${undone.caseId} (${undone.label})`);
                    currentIndex--;
                    break; // Restart the loop to show the previous case
                }
                else {
                    console.log("  ⚠️  Nothing to undo");
                }
            }
            else if (answer === "p") {
                label = "pass";
                failureMode = null;
            }
            else if (answer === "f") {
                label = "fail";
                failureMode = await promptFailureMode(rl);
            }
            else if (answer === "?") {
                console.log("  p — Mark case as passed");
                console.log("  f — Mark case as failed (show failure mode menu)");
                console.log("  u — Undo last label");
                console.log("  q — Quit and save progress");
            }
        }
        if (label) {
            const labeledCase = createLabeledCase(spec, label, failureMode);
            labeled.push(labeledCase);
            console.log(`  ✅ Labeled: ${label}${failureMode ? ` (${failureMode})` : ""}`);
            currentIndex++;
        }
    }
    rl.close();
    printSessionSummary(labeled);
    console.log(`\nSaved → ${path.relative(process.cwd(), outputPath)}`);
    return labeled;
}
// ── Output writing ──
function writeLabeledJsonl(cases, outputPath) {
    const lines = cases.map((c) => JSON.stringify(c)).join("\n");
    fs.writeFileSync(outputPath, lines, "utf-8");
}
// ── Main entrypoint ──
async function runLabel(args) {
    const parsed = parseLabelArgs(args);
    const cwd = process.cwd();
    const runPath = findRunResult(cwd, parsed.runPath);
    if (!runPath) {
        console.error("  ✖ Run result not found.");
        console.error("    Run evalgate run first, or specify --run <path>");
        return 1;
    }
    let runResult = null;
    try {
        const content = fs.readFileSync(runPath, "utf-8");
        runResult = JSON.parse(content);
    }
    catch {
        console.error("  ✖ Failed to read/parse run result");
        return 1;
    }
    if (!runResult || runResult.schemaVersion !== run_1.RUN_RESULT_SCHEMA_VERSION) {
        console.error(`  ✖ Unsupported run result schema version: ${runResult?.schemaVersion ?? "missing"}`);
        return 1;
    }
    const outputPath = parsed.outputPath ?? path.join(cwd, ".evalgate", "golden", "labeled.jsonl");
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`📂 Run result: ${path.relative(cwd, runPath)}`);
    console.log(`📄 Output: ${path.relative(cwd, outputPath)}`);
    const labeled = await labelInteractive(runResult, outputPath);
    try {
        writeLabeledJsonl(labeled, outputPath);
    }
    catch (error) {
        console.error("  ✖ Failed to write output:", error);
        return 2;
    }
    // Session summary is already printed by labelInteractive
    if (parsed.format === "json") {
        console.log("\n📋 Summary (JSON):");
        console.log(JSON.stringify({ total: labeled.length, output: outputPath }, null, 2));
    }
    return 0;
}
