"use strict";
/**
 * evalgate explain — Offline report explainer.
 *
 * Reads the last check/gate report artifact and prints:
 *   1. Top failing test cases (up to 3)
 *   2. What changed (baseline vs current)
 *   3. Likely root cause class
 *   4. Suggested fix actions
 *
 * Works offline — no network calls. Designed for CI logs.
 *
 * Usage:
 *   evalgate explain                             # reads evals/regression-report.json or .evalgate/last-report.json
 *   evalgate explain --report path/to/report.json
 *   evalgate explain --format json
 *
 * Exit codes:
 *   0 — Explained successfully
 *   1 — Report not found or unreadable
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
exports.parseExplainFlags = parseExplainFlags;
exports.runExplain = runExplain;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const types_1 = require("./formatters/types");
// ── Arg parsing ──
function parseExplainFlags(argv) {
    const raw = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                raw[key] = next;
                i++;
            }
            else {
                raw[key] = "true";
            }
        }
    }
    const reportPath = raw.report || raw.reportPath || null;
    const format = raw.format === "json" ? "json" : "human";
    return { reportPath, format };
}
// ── Report discovery ──
const REPORT_SEARCH_PATHS = [
    "evals/regression-report.json",
    ".evalgate/last-report.json",
    ".evalgate/last_report.json",
    ".evalgate/last-run.json",
    ".evalgate/runs/latest.json",
];
function findReport(cwd, explicitPath) {
    if (explicitPath) {
        const abs = path.isAbsolute(explicitPath)
            ? explicitPath
            : path.join(cwd, explicitPath);
        return fs.existsSync(abs) ? abs : null;
    }
    for (const rel of REPORT_SEARCH_PATHS) {
        const abs = path.join(cwd, rel);
        if (fs.existsSync(abs))
            return abs;
    }
    return null;
}
// ── Root cause classification ──
function classifyRootCauses(report) {
    const causes = [];
    const failedCases = report.failedCases ?? [];
    const reasonCode = report.reasonCode ?? "";
    const breakdown = report.breakdown01;
    const delta = report.delta;
    // Safety regression
    if (reasonCode === "POLICY_FAILED" ||
        reasonCode === "SAFETY_RISK" ||
        (breakdown?.safety != null && breakdown.safety < 0.9)) {
        causes.push("safety_regression");
    }
    // Cost regression
    if (reasonCode === "COST_BUDGET_EXCEEDED" || reasonCode === "COST_RISK") {
        causes.push("cost_regression");
    }
    // Latency regression
    if (reasonCode === "LATENCY_BUDGET_EXCEEDED" ||
        reasonCode === "LATENCY_RISK") {
        causes.push("latency_regression");
    }
    // Coverage drop (test count decreased)
    if (reasonCode === "LOW_SAMPLE_SIZE" ||
        reasonCode === "INSUFFICIENT_EVIDENCE") {
        causes.push("coverage_drop");
    }
    // Analyze failed cases for drift patterns
    if (failedCases.length > 0) {
        const outputs = failedCases
            .map((fc) => (fc.output ?? "").toLowerCase())
            .filter(Boolean);
        const expectedOutputs = failedCases
            .map((fc) => (fc.expectedOutput ?? "").toLowerCase())
            .filter(Boolean);
        // Formatting drift: output structure changed (JSON/markdown/format mismatch)
        const hasFormatIssue = outputs.some((o) => o.includes("```") !== expectedOutputs.some((e) => e.includes("```")) ||
            o.includes("{") !== expectedOutputs.some((e) => e.includes("{")) ||
            o.includes("<") !== expectedOutputs.some((e) => e.includes("<")));
        if (hasFormatIssue && failedCases.length >= 2) {
            causes.push("formatting_drift");
        }
        // Tool use drift: output mentions tool calls or function calls
        const hasToolIssue = outputs.some((o) => o.includes("tool_call") ||
            o.includes("function_call") ||
            o.includes("tool_use"));
        if (hasToolIssue) {
            causes.push("tool_use_drift");
        }
        // Retrieval drift: output mentions "not found", "no results", context issues
        const hasRetrievalIssue = outputs.some((o) => o.includes("not found") ||
            o.includes("no results") ||
            o.includes("no relevant") ||
            o.includes("unable to find"));
        if (hasRetrievalIssue) {
            causes.push("retrieval_drift");
        }
        // Prompt drift: catch-all for score regression with failed cases
        if (delta != null &&
            delta < -2 &&
            !causes.includes("formatting_drift") &&
            !causes.includes("tool_use_drift") &&
            !causes.includes("retrieval_drift")) {
            causes.push("prompt_drift");
        }
    }
    // Baseline stale
    if (reasonCode === "BASELINE_MISSING") {
        causes.push("baseline_stale");
    }
    if (causes.length === 0) {
        causes.push("unknown");
    }
    return [...new Set(causes)];
}
// ── Suggested fixes ──
const ROOT_CAUSE_FIXES = {
    prompt_drift: [
        {
            action: "Review prompt changes",
            detail: "Compare current prompt with the version used in baseline run. Diff system/user messages.",
            priority: "high",
        },
        {
            action: "Pin model version",
            detail: "Use a specific model snapshot (e.g. gpt-4-0613) instead of a rolling alias.",
            priority: "medium",
        },
        {
            action: "Update baseline",
            detail: "If changes are intentional, run: npx evalgate baseline update",
            priority: "low",
        },
    ],
    retrieval_drift: [
        {
            action: "Check retrieval pipeline",
            detail: "Verify embeddings, index, and chunk strategy haven't changed.",
            priority: "high",
        },
        {
            action: "Update test case context",
            detail: "If knowledge base changed, update expected outputs in test cases.",
            priority: "medium",
        },
        {
            action: "Add retrieval-specific tests",
            detail: "Add test cases that verify document retrieval before generation.",
            priority: "low",
        },
    ],
    formatting_drift: [
        {
            action: "Update output format instructions",
            detail: "Check if system prompt format instructions match expected output structure.",
            priority: "high",
        },
        {
            action: "Add format validators",
            detail: "Use schema assertions to validate output structure (JSON schema, regex).",
            priority: "medium",
        },
        {
            action: "Refresh baseline",
            detail: "If new format is intentional, run: npx evalgate baseline update",
            priority: "low",
        },
    ],
    tool_use_drift: [
        {
            action: "Verify tool definitions",
            detail: "Check that tool/function schemas match what the model expects.",
            priority: "high",
        },
        {
            action: "Review tool call patterns",
            detail: "Compare tool call sequences in failing vs passing cases.",
            priority: "medium",
        },
        {
            action: "Add tool-use assertions",
            detail: "Assert specific tool calls are made (or not made) per test case.",
            priority: "low",
        },
    ],
    safety_regression: [
        {
            action: "Review safety assertions",
            detail: "Check which safety test cases are failing and why.",
            priority: "high",
        },
        {
            action: "Strengthen guardrails",
            detail: "Add or update content filters, system prompt safety instructions.",
            priority: "high",
        },
        {
            action: "Update rubric",
            detail: "If safety criteria changed, update the LLM judge rubric.",
            priority: "medium",
        },
    ],
    cost_regression: [
        {
            action: "Check token usage",
            detail: "Compare input/output token counts between baseline and current run.",
            priority: "high",
        },
        {
            action: "Optimize prompts",
            detail: "Reduce prompt length or use a smaller model for non-critical paths.",
            priority: "medium",
        },
        {
            action: "Update cost budget",
            detail: "If higher cost is expected, adjust --max-cost-usd threshold.",
            priority: "low",
        },
    ],
    latency_regression: [
        {
            action: "Check response times",
            detail: "Compare per-test-case latency between baseline and current run.",
            priority: "high",
        },
        {
            action: "Reduce prompt complexity",
            detail: "Simplify prompts or use streaming to reduce perceived latency.",
            priority: "medium",
        },
        {
            action: "Update latency budget",
            detail: "If higher latency is expected, adjust --max-latency-ms threshold.",
            priority: "low",
        },
    ],
    coverage_drop: [
        {
            action: "Add test cases",
            detail: "Current test count is below minimum. Add more test cases to the evaluation.",
            priority: "high",
        },
        {
            action: "Check test case filtering",
            detail: "Verify no test cases were accidentally deleted or filtered out.",
            priority: "medium",
        },
    ],
    baseline_stale: [
        {
            action: "Create baseline",
            detail: "Run: npx evalgate baseline init  (or publish a run from the dashboard)",
            priority: "high",
        },
        {
            action: "Use --baseline previous",
            detail: "Compare against the previous run instead of a published baseline.",
            priority: "medium",
        },
    ],
    unknown: [
        {
            action: "Run evalgate doctor",
            detail: "Run: npx evalgate doctor  to check your full CI/CD setup.",
            priority: "high",
        },
        {
            action: "Check logs",
            detail: "Review CI logs for errors or unexpected behavior.",
            priority: "medium",
        },
        {
            action: "Update baseline",
            detail: "If changes are intentional, run: npx evalgate baseline update",
            priority: "low",
        },
    ],
};
function suggestFixes(causes) {
    const seen = new Set();
    const fixes = [];
    for (const cause of causes) {
        for (const fix of ROOT_CAUSE_FIXES[cause] ?? []) {
            if (!seen.has(fix.action)) {
                seen.add(fix.action);
                fixes.push(fix);
            }
        }
    }
    // Sort by priority
    const pOrder = { high: 0, medium: 1, low: 2 };
    return fixes.sort((a, b) => (pOrder[a.priority] ?? 9) - (pOrder[b.priority] ?? 9));
}
// ── Build explain output ──
function buildExplainOutput(report, reportPath) {
    // Support RunResult (from evalgate run) — has schemaVersion + results[] + summary
    const isRunResult = "results" in report &&
        Array.isArray(report.results) &&
        "summary" in report &&
        report.summary !== null &&
        typeof report.summary === "object";
    if (isRunResult) {
        return buildFromRunResult(report, reportPath);
    }
    // Support BuiltinReport (from evalgate gate)
    const isBuiltinReport = "category" in report && "deltas" in report;
    if (isBuiltinReport) {
        return buildFromBuiltinReport(report, reportPath);
    }
    return buildFromCheckReport(report, reportPath);
}
function buildFromRunResult(report, reportPath) {
    const summary = report.summary;
    const results = report.results ?? [];
    const passed = summary.failed === 0;
    // Top failures
    const failures = results.filter((r) => r.result.status === "failed");
    const topFailures = failures.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        name: r.name,
        filePath: r.filePath,
        reason: r.result.error,
    }));
    // Changes: pass rate
    const changes = [
        {
            metric: "Pass rate",
            baseline: "—",
            current: `${Math.round(summary.passRate * 100)}%`,
            direction: passed ? "same" : "worse",
        },
    ];
    // For passing runs, emit nothing so no misleading "Run doctor" suggestions appear
    if (passed) {
        return {
            verdict: "pass",
            reasonMessage: `All ${summary.passed} spec${summary.passed === 1 ? "" : "s"} passed`,
            topFailures: [],
            totalFailures: 0,
            changes,
            rootCauses: [],
            suggestedFixes: [],
            reportPath,
        };
    }
    // Classify root cause by inspecting error messages
    const errorText = failures
        .map((r) => (r.result.error ?? "").toLowerCase())
        .join(" ");
    const rootCauses = [];
    if (errorText.includes("pii") || errorText.includes("safety"))
        rootCauses.push("safety_regression");
    if (errorText.includes("tool") || errorText.includes("function_call"))
        rootCauses.push("tool_use_drift");
    if (rootCauses.length === 0)
        rootCauses.push("prompt_drift");
    return {
        verdict: "fail",
        reasonMessage: `${summary.failed} of ${results.length} spec${results.length === 1 ? "" : "s"} failed`,
        topFailures,
        totalFailures: failures.length,
        changes,
        rootCauses,
        suggestedFixes: suggestFixes(rootCauses),
        reportPath,
    };
}
function buildFromCheckReport(report, reportPath) {
    const failedCases = report.failedCases ?? [];
    // Top failures (up to 3)
    const topFailures = failedCases
        .slice(0, 3)
        .map((fc, i) => ({
        rank: i + 1,
        name: fc.name,
        input: fc.inputSnippet || fc.input,
        expected: fc.expectedSnippet || fc.expectedOutput,
        actual: fc.outputSnippet || fc.output,
        reason: fc.reason,
    }));
    // Changes
    const changes = [];
    if (report.score != null && report.baselineScore != null) {
        const d = report.score - report.baselineScore;
        changes.push({
            metric: "Score",
            baseline: String(report.baselineScore),
            current: String(report.score),
            direction: d > 0 ? "better" : d < 0 ? "worse" : "same",
        });
    }
    if (report.breakdown01?.passRate != null) {
        changes.push({
            metric: "Pass rate",
            baseline: "—",
            current: `${Math.round(report.breakdown01.passRate * 100)}%`,
            direction: "same",
        });
    }
    if (report.breakdown01?.safety != null) {
        changes.push({
            metric: "Safety",
            baseline: "—",
            current: `${Math.round(report.breakdown01.safety * 100)}%`,
            direction: report.breakdown01.safety < 0.95 ? "worse" : "same",
        });
    }
    const rootCauses = classifyRootCauses(report);
    const suggestedFixes = suggestFixes(rootCauses);
    return {
        verdict: report.verdict ?? "unknown",
        score: report.score,
        baselineScore: report.baselineScore,
        delta: report.delta,
        reasonCode: report.reasonCode,
        reasonMessage: report.reasonMessage ?? report.actionableMessage,
        topFailures,
        totalFailures: failedCases.length,
        changes,
        rootCauses,
        suggestedFixes,
        reportPath,
    };
}
function buildFromBuiltinReport(report, reportPath) {
    const passed = report.passed;
    const failures = report.failures ?? [];
    const deltas = report.deltas ?? [];
    const changes = deltas.map((d) => ({
        metric: d.metric,
        baseline: String(d.baseline),
        current: String(d.current),
        direction: d.status === "pass" ? "same" : "worse",
    }));
    const topFailures = failures.slice(0, 3).map((f, i) => ({
        rank: i + 1,
        name: f.length > 60 ? `${f.slice(0, 57)}...` : f,
        reason: f,
    }));
    // Simple root cause for builtin reports
    const rootCauses = [];
    if (failures.some((f) => f.includes("failing")))
        rootCauses.push("prompt_drift");
    if (failures.some((f) => f.includes("count dropped")))
        rootCauses.push("coverage_drop");
    if (rootCauses.length === 0)
        rootCauses.push("unknown");
    return {
        verdict: passed ? "pass" : "fail",
        reasonCode: report.category ?? undefined,
        reasonMessage: failures[0],
        topFailures,
        totalFailures: failures.length,
        changes,
        rootCauses,
        suggestedFixes: suggestFixes(rootCauses),
        reportPath,
    };
}
// ── Output formatting ──
function printHuman(output) {
    const verdictIcon = output.verdict === "pass"
        ? "\u2705"
        : output.verdict === "warn"
            ? "\u26A0\uFE0F"
            : "\u274C";
    console.log(`\n  evalgate explain\n`);
    console.log(`  ${verdictIcon} Verdict: ${output.verdict.toUpperCase()}`);
    if (output.score != null) {
        const scoreStr = output.baselineScore != null
            ? `${output.score} (baseline: ${output.baselineScore}, delta: ${output.delta ?? "n/a"})`
            : `${output.score}`;
        console.log(`  Score: ${scoreStr}`);
    }
    if (output.reasonMessage) {
        console.log(`  Reason: ${output.reasonMessage}`);
    }
    // Changes
    if (output.changes.length > 0) {
        console.log("\n  What changed:");
        for (const c of output.changes) {
            const arrow = c.direction === "worse"
                ? "\u2193"
                : c.direction === "better"
                    ? "\u2191"
                    : "\u2192";
            console.log(`    ${arrow} ${c.metric}: ${c.baseline} \u2192 ${c.current}`);
        }
    }
    // Top failures
    if (output.topFailures.length > 0) {
        console.log(`\n  Top failing cases (${output.topFailures.length} of ${output.totalFailures}):`);
        for (const f of output.topFailures) {
            console.log(`\n    ${f.rank}. ${f.name ?? "unnamed"}`);
            if (f.input)
                console.log(`       Input:    ${f.input}`);
            if (f.expected)
                console.log(`       Expected: ${f.expected}`);
            if (f.actual)
                console.log(`       Actual:   ${f.actual}`);
            if (f.reason)
                console.log(`       Reason:   ${f.reason}`);
        }
    }
    // Root causes
    if (output.rootCauses.length > 0 && output.rootCauses[0] !== "unknown") {
        console.log("\n  Likely root causes:");
        for (const cause of output.rootCauses) {
            console.log(`    \u2022 ${cause.replace(/_/g, " ")}`);
        }
    }
    // Suggested fixes
    if (output.suggestedFixes.length > 0) {
        console.log("\n  Suggested fixes:");
        for (const fix of output.suggestedFixes) {
            const pIcon = fix.priority === "high"
                ? "\u203C\uFE0F"
                : fix.priority === "medium"
                    ? "\u2757"
                    : "\u2022";
            console.log(`    ${pIcon} ${fix.action}`);
            console.log(`      ${fix.detail}`);
        }
    }
    console.log(`\n  Report: ${output.reportPath}\n`);
}
// ── Main ──
async function runExplain(argv) {
    const flags = parseExplainFlags(argv);
    const cwd = process.cwd();
    const reportPath = findReport(cwd, flags.reportPath);
    if (!reportPath) {
        const searched = flags.reportPath
            ? flags.reportPath
            : REPORT_SEARCH_PATHS.join(", ");
        console.error(`\n  \u274C No report found. Searched: ${searched}`);
        console.error("  Run a gate first:");
        console.error("    npx evalgate gate --format json");
        console.error("    npx evalgate check --format json > .evalgate/last-report.json\n");
        return 1;
    }
    let reportData;
    try {
        reportData = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    }
    catch {
        console.error(`\n  \u274C Cannot parse report: ${reportPath}\n`);
        return 1;
    }
    // Schema version compatibility check
    const reportSchema = typeof reportData.schemaVersion === "number"
        ? reportData.schemaVersion
        : undefined;
    if (reportSchema != null && reportSchema > types_1.CHECK_REPORT_SCHEMA_VERSION) {
        console.error(`\n  \u26A0\uFE0F  Report schema version ${reportSchema} is newer than this CLI supports (v${types_1.CHECK_REPORT_SCHEMA_VERSION}).`);
        console.error("  Update your SDK: npm install @evalgate/sdk@latest\n");
    }
    const output = buildExplainOutput(reportData, path.relative(cwd, reportPath));
    if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2));
    }
    else {
        printHuman(output);
    }
    return 0;
}
