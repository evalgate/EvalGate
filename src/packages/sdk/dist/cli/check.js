#!/usr/bin/env node
"use strict";
/**
 * evalgate check — CI/CD evaluation gate
 *
 * Usage:
 *   evalgate check --minScore 92 --evaluationId 42
 *   evalgate check --minScore 90 --maxDrop 5 --evaluationId 42
 *   evalgate check --policy HIPAA --evaluationId 42
 *   evalgate check --baseline published --evaluationId 42
 *
 * Flags:
 *   --minScore <n>       Fail if quality score < n (0-100)
 *   --maxDrop <n>        Fail if score dropped > n points from baseline
 *   --minN <n>           Fail if total test cases < n (low sample size)
 *   --allowWeakEvidence  If false (default), fail when evidenceLevel is 'weak'
 *   --policy <name>      Enforce a compliance policy (e.g. HIPAA, SOC2, GDPR)
 *   --baseline <mode>   Baseline comparison mode: "published" (default), "previous", or "production"
 *   --evaluationId <id>  Required. The evaluation to gate on.
 *   --baseUrl <url>      API base URL (default: EVALGATE_BASE_URL or https://api.evalgate.com)
 *   --apiKey <key>       API key (default: EVALGATE_API_KEY env var)
 *   --share <mode>       Share link: "always" | "fail" | "never" (default: never)
 *                        fail = create public share link only when gate fails (CI-friendly)
 *   --pr-comment-out <file>  Write PR comment markdown to file (for GitHub Action to post)
 *   --profile <name>         Preset: strict (95/0/30), balanced (90/2/10), fast (85/5/5). Explicit flags override.
 *   --dry-run               Run all checks and print results, but always exit 0
 *
 * Exit codes:
 *   0  — Gate passed
 *   1  — Gate failed: score below threshold
 *   2  — Gate failed: regression exceeded maxDrop
 *   3  — Gate failed: policy violation
 *   4  — API error / network failure
 *   5  — Invalid arguments
 *   6  — Gate failed: total test cases < minN
 *   7  — Gate failed: weak evidence (evidenceLevel === 'weak')
 *   8  — Gate warned: near-regression (warnDrop ≤ drop < maxDrop)
 *
 * Environment:
 *   EVALGATE_BASE_URL  — API base URL (default: https://api.evalgate.com)
 *   EVALGATE_API_KEY   — API key for authentication
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
exports.EXIT = void 0;
exports.parseArgs = parseArgs;
exports.runCheck = runCheck;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const constants_1 = require("../constants");
const api_1 = require("./api");
const ci_context_1 = require("./ci-context");
const config_1 = require("./config");
const constants_2 = require("./constants");
const github_1 = require("./formatters/github");
const human_1 = require("./formatters/human");
const json_1 = require("./formatters/json");
const pr_comment_1 = require("./formatters/pr-comment");
const gate_1 = require("./gate");
const build_check_report_1 = require("./report/build-check-report");
var constants_3 = require("./constants");
Object.defineProperty(exports, "EXIT", { enumerable: true, get: function () { return constants_3.EXIT; } });
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                args[key] = next;
                i++;
            }
            else {
                args[key] = "true";
            }
        }
    }
    let baseUrl = args.baseUrl || process.env.EVALGATE_BASE_URL || constants_1.DEFAULT_BASE_URL;
    const apiKey = args.apiKey ||
        process.env.EVALGATE_API_KEY ||
        process.env.EVALAI_API_KEY ||
        "";
    let minScore = parseInt(args.minScore || "0", 10);
    let maxDrop = args.maxDrop ? parseInt(args.maxDrop, 10) : undefined;
    let warnDrop = args.warnDrop ? parseInt(args.warnDrop, 10) : undefined;
    let minN = args.minN ? parseInt(args.minN, 10) : undefined;
    let allowWeakEvidence = args.allowWeakEvidence === "true" || args.allowWeakEvidence === "1";
    let evaluationId = args.evaluationId || "";
    const policy = args.policy || undefined;
    const formatRaw = args.format || "human";
    const format = formatRaw === "json" ? "json" : formatRaw === "github" ? "github" : "human";
    const explain = args.explain === "true" || args.explain === "1";
    const onFail = args.onFail === "import" ? "import" : undefined;
    const dryRun = args["dry-run"] === "true" || args.dryRun === "true";
    const shareRaw = args.share || "never";
    const share = shareRaw === "always" ? "always" : shareRaw === "fail" ? "fail" : "never";
    const prCommentOut = args["pr-comment-out"] || args.prCommentOut || undefined;
    const maxCostUsd = args["max-cost-usd"] || args.maxCostUsd
        ? parseFloat(args["max-cost-usd"] || args.maxCostUsd || "0")
        : undefined;
    const maxLatencyMs = args["max-latency-ms"] || args.maxLatencyMs
        ? parseInt(args["max-latency-ms"] || args.maxLatencyMs || "0", 10)
        : undefined;
    const maxCostDeltaUsd = args["max-cost-delta-usd"] || args.maxCostDeltaUsd
        ? parseFloat(args["max-cost-delta-usd"] || args.maxCostDeltaUsd || "0")
        : undefined;
    const profile = (args.profile || args.profile);
    let baseline = (args.baseline === "auto"
        ? "auto"
        : args.baseline === "previous"
            ? "previous"
            : args.baseline === "production"
                ? "production"
                : "published");
    const config = (0, config_1.loadConfig)(process.cwd());
    const merged = (0, config_1.mergeConfigWithArgs)(config, {
        evaluationId: args.evaluationId,
        baseUrl: args.baseUrl ||
            process.env.EVALGATE_BASE_URL ||
            process.env.EVALAI_BASE_URL,
        minScore: args.minScore,
        maxDrop: args.maxDrop,
        warnDrop: args.warnDrop,
        minN: args.minN,
        allowWeakEvidence: args.allowWeakEvidence,
        baseline: args.baseline,
        profile: profile,
        prCommentOut: args["pr-comment-out"] ?? args.prCommentOut,
    });
    if (!evaluationId && merged.evaluationId)
        evaluationId = merged.evaluationId;
    if (merged.baseUrl)
        baseUrl = merged.baseUrl;
    if (merged.minScore != null && args.minScore === undefined)
        minScore = merged.minScore ?? 0;
    if (merged.maxDrop != null && args.maxDrop === undefined)
        maxDrop = merged.maxDrop;
    if (merged.warnDrop != null && args.warnDrop === undefined)
        warnDrop = merged.warnDrop;
    if (merged.minN != null && args.minN === undefined)
        minN = merged.minN;
    if (merged.allowWeakEvidence != null && args.allowWeakEvidence === undefined)
        allowWeakEvidence = merged.allowWeakEvidence ?? false;
    if (merged.baseline && !args.baseline)
        baseline = merged.baseline;
    if (!apiKey) {
        return {
            ok: false,
            exitCode: constants_2.EXIT.BAD_ARGS,
            message: "Error: --apiKey or EVALGATE_API_KEY is required",
        };
    }
    if (!evaluationId) {
        return {
            ok: false,
            exitCode: constants_2.EXIT.BAD_ARGS,
            message: "Run npx evalgate init and paste your evaluationId, or pass --evaluationId.",
        };
    }
    if (Number.isNaN(minScore) || minScore < 0 || minScore > 100) {
        return {
            ok: false,
            exitCode: constants_2.EXIT.BAD_ARGS,
            message: "Error: --minScore must be 0-100",
        };
    }
    if (minN !== undefined && (Number.isNaN(minN) || minN < 1)) {
        return {
            ok: false,
            exitCode: constants_2.EXIT.BAD_ARGS,
            message: "Error: --minN must be a positive number",
        };
    }
    return {
        ok: true,
        args: {
            baseUrl,
            apiKey,
            minScore,
            maxDrop,
            warnDrop,
            minN,
            allowWeakEvidence,
            evaluationId,
            policy,
            baseline,
            format,
            explain,
            onFail,
            share,
            prCommentOut,
            maxCostUsd: maxCostUsd != null && !Number.isNaN(maxCostUsd)
                ? maxCostUsd
                : undefined,
            maxLatencyMs: maxLatencyMs != null && !Number.isNaN(maxLatencyMs)
                ? maxLatencyMs
                : undefined,
            maxCostDeltaUsd: maxCostDeltaUsd != null && !Number.isNaN(maxCostDeltaUsd)
                ? maxCostDeltaUsd
                : undefined,
            dryRun: dryRun || undefined,
        },
    };
}
async function runCheck(args) {
    const qualityResult = await (0, api_1.fetchQualityLatest)(args.baseUrl, args.apiKey, args.evaluationId, args.baseline);
    if (!qualityResult.ok) {
        if (qualityResult.status === 0) {
            console.error(`EvalGate gate ERROR: Network failure — ${qualityResult.body}`);
        }
        else {
            console.error(`EvalGate gate ERROR: API returned ${qualityResult.status} — ${qualityResult.body}`);
        }
        return constants_2.EXIT.API_ERROR;
    }
    const { data: quality, requestId } = qualityResult;
    const evaluationRunId = quality?.evaluationRunId;
    let runDetails = null;
    if (evaluationRunId != null) {
        const runRes = await (0, api_1.fetchRunDetails)(args.baseUrl, args.apiKey, args.evaluationId, evaluationRunId);
        if (runRes.ok)
            runDetails = runRes.data;
    }
    const gateResult = (0, gate_1.evaluateGate)(args, quality);
    // Create share before report when PR comment needs shareUrl (--pr-comment-out + --share fail + gate failed)
    let shareUrl;
    const shouldCreateShare = quality?.evaluationRunId != null &&
        (args.share === "always" || (args.share === "fail" && !gateResult.passed));
    if (shouldCreateShare) {
        const exportRes = await (0, api_1.fetchRunExport)(args.baseUrl, args.apiKey, args.evaluationId, quality.evaluationRunId);
        if (exportRes.ok) {
            const publishRes = await (0, api_1.publishShare)(args.baseUrl, args.apiKey, args.evaluationId, exportRes.exportData, quality.evaluationRunId);
            if (publishRes.ok) {
                shareUrl = publishRes.data.shareUrl;
                console.error(`\nPublic share link created: ${shareUrl}`);
            }
        }
    }
    const ci = (0, ci_context_1.captureCiContext)();
    const report = (0, build_check_report_1.buildCheckReport)({
        args,
        quality,
        runDetails,
        gateResult,
        requestId,
        shareUrl,
        baselineRunId: quality?.baselineRunId ?? undefined,
        ciRunUrl: ci?.runUrl ?? undefined,
    });
    // Persist report artifact so `evalgate explain` works with zero flags
    try {
        const reportDir = path.join(process.cwd(), ".evalgate");
        if (!fs.existsSync(reportDir))
            fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(path.join(reportDir, "last-report.json"), JSON.stringify(report, null, 2), "utf8");
    }
    catch {
        // Non-fatal: best-effort artifact write
    }
    const formatted = args.format === "json"
        ? (0, json_1.formatJson)(report)
        : args.format === "github"
            ? (0, github_1.formatGitHub)(report)
            : (0, human_1.formatHuman)(report);
    console.log(formatted);
    // Guided flow hint on failure
    if (!gateResult.passed) {
        console.error("\nNext: evalgate explain");
    }
    // --pr-comment-out: write markdown to file for GitHub Action to post
    if (args.prCommentOut) {
        try {
            const markdown = (0, pr_comment_1.buildPrComment)(report);
            fs.writeFileSync(args.prCommentOut, markdown, "utf8");
        }
        catch (err) {
            console.error(`EvalGate: failed to write PR comment to ${args.prCommentOut}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // --onFail import: when gate fails, import run with CI context
    if (!gateResult.passed &&
        args.onFail === "import" &&
        runDetails?.results &&
        quality?.evaluationRunId) {
        const importResults = runDetails.results
            .filter((r) => r.testCaseId != null &&
            (r.status === "passed" || r.status === "failed"))
            .map((r) => ({
            testCaseId: r.testCaseId,
            status: r.status,
            output: r.output ?? "",
            latencyMs: r.durationMs,
            assertionsJson: r.assertionsJson,
        }));
        if (importResults.length > 0) {
            const idempotencyKey = ci
                ? (0, ci_context_1.computeIdempotencyKey)(args.evaluationId, ci)
                : undefined;
            const importRes = await (0, api_1.importRunOnFail)(args.baseUrl, args.apiKey, args.evaluationId, importResults, {
                idempotencyKey,
                ci,
                importClientVersion: "evalgate-cli",
                checkReport: report,
            });
            if (!importRes.ok) {
                console.error(`EvalGate import (onFail): ${importRes.status} — ${importRes.body}`);
            }
        }
    }
    if (args.dryRun) {
        console.error(`\n[dry-run] Gate would have exited with code ${gateResult.exitCode}`);
        return constants_2.EXIT.PASS;
    }
    return gateResult.exitCode;
}
// Main entry point
const isDirectRun = typeof require !== "undefined" && require.main === module;
if (isDirectRun) {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed.ok) {
        console.error(parsed.message);
        process.exit(parsed.exitCode);
    }
    runCheck(parsed.args)
        .then((code) => process.exit(code))
        .catch((err) => {
        console.error(`EvalGate gate ERROR: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(constants_2.EXIT.API_ERROR);
    });
}
