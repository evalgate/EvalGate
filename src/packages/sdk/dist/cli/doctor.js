"use strict";
/**
 * evalgate doctor — Comprehensive CI/CD readiness checklist.
 *
 * Runs itemized pass/fail checks with exact remediation commands.
 *
 * Exit codes:
 *   0 — All checks passed (ready)
 *   2 — One or more checks failed (not ready)
 *   3 — Infrastructure error (couldn't complete checks)
 *
 * Flags:
 *   --report          Output JSON diagnostic bundle (redacted)
 *   --format <fmt>    Output format: human (default), json
 *   --apiKey <key>    API key (or EVALGATE_API_KEY env)
 *   --baseUrl <url>   API base URL
 *   --evaluationId <id>  Evaluation to verify
 *   --baseline <mode> Baseline mode
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
exports.DOCTOR_EXIT = void 0;
exports.checkJudgeConfig = checkJudgeConfig;
exports.checkGoldenSetHealth = checkGoldenSetHealth;
exports.checkProject = checkProject;
exports.checkConfig = checkConfig;
exports.checkBaseline = checkBaseline;
exports.checkAuth = checkAuth;
exports.checkConnectivity = checkConnectivity;
exports.checkEvalTarget = checkEvalTarget;
exports.checkEvalAccess = checkEvalAccess;
exports.checkJudgeCredibilityWarnings = checkJudgeCredibilityWarnings;
exports.checkCiWiring = checkCiWiring;
exports.checkProviderEnv = checkProviderEnv;
exports.checkReplayDecisionReadiness = checkReplayDecisionReadiness;
exports.runDoctor = runDoctor;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const version_1 = require("../version");
const api_1 = require("./api");
const config_1 = require("./config");
const judge_credibility_1 = require("./judge-credibility");
// ── Exit codes ──
exports.DOCTOR_EXIT = {
    READY: 0,
    NOT_READY: 2,
    INFRA_ERROR: 3,
};
// ── Arg parsing ──
function parseFlags(argv) {
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
    const report = raw.report === "true" || raw.report === "1";
    const fmt = raw.format === "json" ? "json" : "human";
    const baseUrl = raw.baseUrl ||
        process.env.EVALGATE_BASE_URL ||
        process.env.EVALAI_BASE_URL ||
        "https://api.evalgate.com";
    const apiKey = raw.apiKey ||
        process.env.EVALGATE_API_KEY ||
        process.env.EVALAI_API_KEY ||
        "";
    let evaluationId = raw.evaluationId || "";
    const baseline = (raw.baseline === "previous"
        ? "previous"
        : raw.baseline === "production"
            ? "production"
            : "published");
    // Try to fill evaluationId from config
    if (!evaluationId) {
        const config = (0, config_1.loadConfig)(process.cwd());
        const merged = (0, config_1.mergeConfigWithArgs)(config, {
            evaluationId: raw.evaluationId,
            baseUrl: raw.baseUrl ||
                process.env.EVALGATE_BASE_URL ||
                process.env.EVALAI_BASE_URL,
            baseline: raw.baseline,
        });
        if (merged.evaluationId)
            evaluationId = String(merged.evaluationId);
    }
    const strict = raw.strict === "true" || raw.strict === "1";
    return {
        report,
        format: report ? "json" : fmt,
        strict,
        baseUrl,
        apiKey,
        evaluationId,
        baseline,
    };
}
function checkJudgeConfig(cwd, config) {
    const judge = config?.judge;
    if (!judge) {
        return {
            id: "judge_config",
            label: "Judge alignment config",
            status: "skip",
            message: "No judge config found (optional until judge credibility is enabled)",
            judgeInfo: { configured: false },
        };
    }
    if (typeof judge.bootstrapSeed === "number" &&
        (!Number.isFinite(judge.bootstrapSeed) ||
            !Number.isInteger(judge.bootstrapSeed))) {
        return {
            id: "judge_config",
            label: "Judge alignment config",
            status: "fail",
            message: "judge.bootstrapSeed must be a finite integer for deterministic CI output",
            remediation: "Set judge.bootstrapSeed to an integer (recommended default: 42)",
            judgeInfo: {
                configured: true,
                bootstrapIterations: judge.bootstrapIterations,
                bootstrapSeed: judge.bootstrapSeed,
            },
        };
    }
    const judgeInfo = {
        configured: true,
        bootstrapIterations: judge.bootstrapIterations,
        bootstrapSeed: judge.bootstrapSeed,
    };
    if (!judge.labeledDatasetPath) {
        return {
            id: "judge_config",
            label: "Judge alignment config",
            status: "warn",
            message: "judge config present but judge.labeledDatasetPath is missing",
            remediation: "Add judge.labeledDatasetPath in evalgate.config.json to enable judge alignment checks",
            judgeInfo,
        };
    }
    // Check if labeled dataset exists
    const datasetPath = path.isAbsolute(judge.labeledDatasetPath)
        ? judge.labeledDatasetPath
        : path.join(cwd, judge.labeledDatasetPath);
    judgeInfo.labeledDatasetPath = datasetPath;
    judgeInfo.labeledDatasetExists = fs.existsSync(datasetPath);
    if (!judgeInfo.labeledDatasetExists) {
        return {
            id: "judge_config",
            label: "Judge alignment config",
            status: "warn",
            message: `Labeled dataset not found at ${datasetPath}`,
            remediation: "Run 'evalgate label' to create a labeled golden dataset, or update judge.labeledDatasetPath",
            judgeInfo,
        };
    }
    return {
        id: "judge_config",
        label: "Judge alignment config",
        status: "pass",
        message: "Judge config and labeled dataset found",
        judgeInfo,
    };
}
function checkGoldenSetHealth(cwd, config) {
    const datasetPath = config?.judge?.labeledDatasetPath
        ? path.isAbsolute(config.judge.labeledDatasetPath)
            ? config.judge.labeledDatasetPath
            : path.join(cwd, config.judge.labeledDatasetPath)
        : null;
    if (!datasetPath || !fs.existsSync(datasetPath)) {
        return {
            id: "golden_set_health",
            label: "Golden dataset health",
            status: "skip",
            message: "No labeled dataset found (run 'evalgate label' to create one)",
        };
    }
    try {
        const content = fs.readFileSync(datasetPath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            return {
                id: "golden_set_health",
                label: "Golden dataset health",
                status: "warn",
                message: "Labeled dataset is empty",
                remediation: "Run 'evalgate label' to add labeled cases",
            };
        }
        // Parse and analyze dataset
        let passCount = 0;
        let failCount = 0;
        const failureModes = new Map();
        const caseIds = new Set();
        let staleCount = 0;
        const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
        for (const line of lines) {
            try {
                const labeled = JSON.parse(line);
                // Check for duplicate case IDs
                if (caseIds.has(labeled.caseId)) {
                    return {
                        id: "golden_set_health",
                        label: "Golden dataset health",
                        status: "fail",
                        message: `Duplicate caseId found: ${labeled.caseId}`,
                        remediation: "Remove duplicate entries or regenerate labeled dataset",
                    };
                }
                caseIds.add(labeled.caseId);
                // Count pass/fail
                if (labeled.label === "pass") {
                    passCount++;
                }
                else if (labeled.label === "fail") {
                    failCount++;
                    if (labeled.failureMode) {
                        failureModes.set(labeled.failureMode, (failureModes.get(labeled.failureMode) || 0) + 1);
                    }
                }
                // Check staleness
                const labeledAt = new Date(labeled.labeledAt).getTime();
                if (labeledAt < sixMonthsAgo) {
                    staleCount++;
                }
            }
            catch {
                return {
                    id: "golden_set_health",
                    label: "Golden dataset health",
                    status: "fail",
                    message: "Invalid JSONL format in labeled dataset",
                    remediation: "Regenerate labeled dataset with 'evalgate label'",
                };
            }
        }
        const total = passCount + failCount;
        const passRate = total > 0 ? passCount / total : 0;
        const failRate = total > 0 ? failCount / total : 0;
        // Health checks
        const issues = [];
        if (total < 30) {
            issues.push(`Small dataset size (${total} samples, recommend ≥30 for statistical significance)`);
        }
        if (passRate > 0.95) {
            issues.push(`Very high pass rate (${(passRate * 100).toFixed(1)}%), may lack challenging cases`);
        }
        else if (passRate < 0.3) {
            issues.push(`Very low pass rate (${(passRate * 100).toFixed(1)}%), may be too difficult or labels incorrect`);
        }
        if (failCount > 0 && failureModes.size === 0) {
            issues.push("Failed cases have no failure modes assigned");
        }
        if (staleCount > total * 0.5) {
            issues.push(`${staleCount} samples (${((staleCount / total) * 100).toFixed(1)}%) are older than 6 months`);
        }
        if (issues.length > 0) {
            return {
                id: "golden_set_health",
                label: "Golden dataset health",
                status: "warn",
                message: `Health issues detected: ${issues.join("; ")}`,
                details: {
                    totalSamples: total,
                    passRate: roundPct(passRate, 1),
                    failRate: roundPct(failRate, 1),
                    failureModeCount: failureModes.size,
                    staleSamples: staleCount,
                    issues,
                },
                remediation: "Consider adding more diverse cases, reviewing labels, or updating stale samples",
            };
        }
        return {
            id: "golden_set_health",
            label: "Golden dataset health",
            status: "pass",
            message: `Healthy dataset: ${total} samples (${passCount} pass, ${failCount} fail), ${failureModes.size} failure modes`,
            details: {
                totalSamples: total,
                passRate: roundPct(passRate, 1),
                failRate: roundPct(failRate, 1),
                failureModeCount: failureModes.size,
                staleSamples: staleCount,
            },
        };
    }
    catch (error) {
        return {
            id: "golden_set_health",
            label: "Golden dataset health",
            status: "fail",
            message: `Failed to read labeled dataset: ${error}`,
            remediation: "Check file permissions and format",
        };
    }
}
function roundPct(value, precision = 1) {
    return Math.round(value * 100 * 10 ** precision) / 10 ** precision;
}
// ── Individual checks ──
function checkProject(cwd) {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        return {
            id: "project",
            label: "Project detection",
            status: "fail",
            message: "No package.json found",
            remediation: "Run this command from your project root, or run: npm init -y",
        };
    }
    let pm = "npm";
    if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml")))
        pm = "pnpm";
    else if (fs.existsSync(path.join(cwd, "yarn.lock")))
        pm = "yarn";
    const hasLockfile = fs.existsSync(path.join(cwd, "package-lock.json")) ||
        fs.existsSync(path.join(cwd, "pnpm-lock.yaml")) ||
        fs.existsSync(path.join(cwd, "yarn.lock"));
    if (!hasLockfile) {
        return {
            id: "project",
            label: "Project detection",
            status: "warn",
            message: `${pm} project detected but no lockfile found`,
            remediation: `Run: ${pm} install`,
        };
    }
    return {
        id: "project",
        label: "Project detection",
        status: "pass",
        message: `${pm} project with lockfile`,
    };
}
function checkConfig(cwd) {
    const configPath = (0, config_1.findConfigPath)(cwd);
    if (!configPath) {
        return {
            id: "config",
            label: "Config file",
            status: "fail",
            message: "No evalgate.config.json (or evalai.config.json) found",
            remediation: "Run: npx evalgate init",
            config: null,
            configPath: null,
        };
    }
    const config = (0, config_1.loadConfig)(cwd);
    if (!config) {
        return {
            id: "config",
            label: "Config file",
            status: "fail",
            message: `Config at ${path.relative(cwd, configPath)} is invalid JSON`,
            remediation: "Fix JSON syntax in your config file, or delete it and run: npx evalgate init",
            config: null,
            configPath,
        };
    }
    // Check required fields — gate config lives in the raw JSON but EvalAIConfig only exposes typed fields
    if (!config.evaluationId && !config.baseline) {
        return {
            id: "config",
            label: "Config file",
            status: "warn",
            message: `Config at ${path.relative(cwd, configPath)} has no evaluationId or gate section`,
            remediation: "Add evaluationId to evalgate.config.json (from the dashboard) or ensure gate.baseline is set",
            config,
            configPath,
        };
    }
    return {
        id: "config",
        label: "Config file",
        status: "pass",
        message: `Loaded ${path.relative(cwd, configPath)}`,
        config,
        configPath,
    };
}
function checkBaseline(cwd) {
    const baselinePath = path.join(cwd, "evals", "baseline.json");
    if (!fs.existsSync(baselinePath)) {
        return {
            id: "baseline",
            label: "Baseline file",
            status: "fail",
            message: "evals/baseline.json not found",
            remediation: "Run: npx evalgate init  (or: npx evalgate baseline init)",
            baselineInfo: { path: "evals/baseline.json", exists: false },
        };
    }
    let data;
    try {
        data = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
    }
    catch {
        return {
            id: "baseline",
            label: "Baseline file",
            status: "fail",
            message: "evals/baseline.json is not valid JSON",
            remediation: "Delete evals/baseline.json and run: npx evalgate baseline init",
            baselineInfo: { path: "evals/baseline.json", exists: true },
        };
    }
    const schemaVersion = typeof data.schemaVersion === "number" ? data.schemaVersion : undefined;
    const hash = (0, node_crypto_1.createHash)("sha256")
        .update(JSON.stringify(data))
        .digest("hex")
        .slice(0, 12);
    const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : undefined;
    // Staleness: warn if baseline older than 30 days
    let stale = false;
    if (updatedAt) {
        const age = Date.now() - new Date(updatedAt).getTime();
        stale = age > 30 * 24 * 60 * 60 * 1000;
    }
    if (schemaVersion !== 1) {
        return {
            id: "baseline",
            label: "Baseline file",
            status: "fail",
            message: `Unsupported baseline schemaVersion: ${schemaVersion ?? "missing"}`,
            remediation: "Run: npx evalgate baseline init  (creates schemaVersion 1)",
            baselineInfo: {
                path: "evals/baseline.json",
                exists: true,
                hash,
                schemaVersion,
            },
        };
    }
    if (stale) {
        return {
            id: "baseline",
            label: "Baseline file",
            status: "warn",
            message: `Baseline is stale (last updated ${updatedAt})`,
            remediation: "Run: npx evalgate baseline update",
            baselineInfo: {
                path: "evals/baseline.json",
                exists: true,
                hash,
                schemaVersion,
                stale,
            },
        };
    }
    return {
        id: "baseline",
        label: "Baseline file",
        status: "pass",
        message: `schemaVersion ${schemaVersion}, hash ${hash}`,
        baselineInfo: {
            path: "evals/baseline.json",
            exists: true,
            hash,
            schemaVersion,
            stale,
        },
    };
}
function checkAuth(apiKey) {
    if (!apiKey) {
        return {
            id: "auth",
            label: "Authentication",
            status: "fail",
            message: "No API key found",
            remediation: "Set EVALGATE_API_KEY environment variable, or pass --apiKey <key>",
        };
    }
    // Redact key for display
    const redacted = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";
    return {
        id: "auth",
        label: "Authentication",
        status: "pass",
        message: `API key present (${redacted})`,
    };
}
async function checkConnectivity(baseUrl, apiKey) {
    const url = `${baseUrl.replace(/\/$/, "")}/api/mcp/tools`;
    const t0 = Date.now();
    try {
        const res = await fetch(url, {
            headers: {
                "X-EvalGate-SDK-Version": version_1.SDK_VERSION,
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            signal: AbortSignal.timeout(10000),
        });
        const latencyMs = Date.now() - t0;
        if (!res.ok) {
            return {
                id: "connectivity",
                label: "API connectivity",
                status: "fail",
                message: `${baseUrl} returned ${res.status}`,
                remediation: res.status === 401
                    ? "Check your API key is valid"
                    : `Verify EVALGATE_BASE_URL is correct (currently: ${baseUrl})`,
                latencyMs,
            };
        }
        if (latencyMs > 5000) {
            return {
                id: "connectivity",
                label: "API connectivity",
                status: "warn",
                message: `${baseUrl} reachable but slow (${latencyMs}ms)`,
                latencyMs,
            };
        }
        return {
            id: "connectivity",
            label: "API connectivity",
            status: "pass",
            message: `${baseUrl} reachable (${latencyMs}ms)`,
            latencyMs,
        };
    }
    catch (err) {
        return {
            id: "connectivity",
            label: "API connectivity",
            status: "fail",
            message: `Cannot reach ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
            remediation: `Verify EVALGATE_BASE_URL is correct and the server is running`,
        };
    }
}
function checkEvalTarget(evaluationId) {
    if (!evaluationId) {
        return {
            id: "eval_target",
            label: "Evaluation target",
            status: "fail",
            message: "No evaluationId configured",
            remediation: "Add evaluationId to evalgate.config.json, or pass --evaluationId <id>",
        };
    }
    return {
        id: "eval_target",
        label: "Evaluation target",
        status: "pass",
        message: `evaluationId: ${evaluationId}`,
    };
}
async function checkEvalAccess(baseUrl, apiKey, evaluationId, baseline) {
    if (!apiKey || !evaluationId) {
        return {
            id: "eval_access",
            label: "Evaluation access",
            status: "skip",
            message: "Skipped (missing apiKey or evaluationId)",
            quality: undefined,
        };
    }
    const result = await (0, api_1.fetchQualityLatest)(baseUrl, apiKey, evaluationId, baseline);
    if (!result.ok) {
        if (result.status === 0) {
            return {
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: `Network error reaching quality endpoint`,
                remediation: `Check connectivity and API key`,
                quality: undefined,
            };
        }
        if (result.status === 401 || result.status === 403) {
            return {
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: `Access denied (${result.status}) for evaluationId ${evaluationId}`,
                remediation: "Verify your API key has eval:read and runs:read scopes",
                quality: undefined,
            };
        }
        if (result.status === 404) {
            return {
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: `Evaluation ${evaluationId} not found`,
                remediation: "Check the evaluationId in your config matches an existing evaluation",
                quality: undefined,
            };
        }
        return {
            id: "eval_access",
            label: "Evaluation access",
            status: "fail",
            message: `Quality API returned ${result.status}`,
            remediation: `API response: ${result.body?.slice(0, 200)}`,
            quality: undefined,
        };
    }
    if (result.data.baselineMissing === true) {
        return {
            id: "eval_access",
            label: "Evaluation access",
            status: "warn",
            message: `Evaluation ${evaluationId} accessible, but no baseline run found`,
            remediation: "Publish a run from the dashboard, or use --baseline previous once you have runs",
            quality: result.data,
        };
    }
    return {
        id: "eval_access",
        label: "Evaluation access",
        status: "pass",
        message: `Evaluation ${evaluationId} accessible, score: ${result.data.score ?? "n/a"}`,
        quality: result.data,
    };
}
function checkJudgeCredibilityWarnings(quality) {
    const judgeAlignment = quality?.judgeAlignment;
    if (!judgeAlignment) {
        return [
            {
                id: "judge_quality_signals",
                label: "Judge correction viability",
                status: "skip",
                message: "No judge alignment metrics on latest run (cannot assess correction viability)",
            },
        ];
    }
    const checks = [];
    const tpr = judgeAlignment.tpr;
    const tnr = judgeAlignment.tnr;
    const sampleSize = judgeAlignment.sampleSize;
    if (typeof tpr === "number" && typeof tnr === "number") {
        const discriminativePower = tpr + tnr - 1;
        if (discriminativePower <= judge_credibility_1.MIN_DISCRIMINATIVE_POWER) {
            checks.push({
                id: "judge_correction_viability",
                label: "Judge correction viability",
                status: "warn",
                message: `Judge appears near-random (TPR + TNR - 1 = ${discriminativePower.toFixed(3)} <= ${judge_credibility_1.MIN_DISCRIMINATIVE_POWER}). Correction will be skipped and raw rate used.`,
                remediation: "Improve judge prompt/calibration and relabel sample data before enforcing corrected-rate gates",
            });
        }
        else {
            checks.push({
                id: "judge_correction_viability",
                label: "Judge correction viability",
                status: "pass",
                message: `Judge discriminative power is ${discriminativePower.toFixed(3)} (> ${judge_credibility_1.MIN_DISCRIMINATIVE_POWER})`,
            });
        }
    }
    else {
        checks.push({
            id: "judge_correction_viability",
            label: "Judge correction viability",
            status: "warn",
            message: "Missing TPR/TNR metrics; cannot determine whether correction is reliable",
            remediation: "Ensure judge alignment metrics (TPR/TNR) are computed and published for the target evaluation",
        });
    }
    if (typeof sampleSize === "number") {
        if (sampleSize < judge_credibility_1.MIN_BOOTSTRAP_SAMPLE_SIZE) {
            checks.push({
                id: "judge_ci_sample_size",
                label: "Judge CI sample size",
                status: "warn",
                message: `Sample size ${sampleSize} < ${judge_credibility_1.MIN_BOOTSTRAP_SAMPLE_SIZE}; bootstrap CI will be skipped`,
                remediation: "Collect at least 30 labeled samples before relying on CI bounds",
            });
        }
        else {
            checks.push({
                id: "judge_ci_sample_size",
                label: "Judge CI sample size",
                status: "pass",
                message: `Sample size ${sampleSize} is sufficient for bootstrap CI`,
            });
        }
    }
    else {
        checks.push({
            id: "judge_ci_sample_size",
            label: "Judge CI sample size",
            status: "warn",
            message: "Missing judge sample size; cannot validate CI reliability",
            remediation: "Publish judge sample size metrics so CI sufficiency checks can run",
        });
    }
    return checks;
}
function checkCiWiring(cwd) {
    const evalgatePath = path.join(".github", "workflows", "evalgate-gate.yml");
    const legacyPath = path.join(".github", "workflows", "evalai-gate.yml");
    const absEvalgate = path.join(cwd, evalgatePath);
    const absLegacy = path.join(cwd, legacyPath);
    const absPath = fs.existsSync(absEvalgate)
        ? absEvalgate
        : fs.existsSync(absLegacy)
            ? absLegacy
            : null;
    const workflowPath = absPath ? path.relative(cwd, absPath) : evalgatePath;
    if (!absPath) {
        return {
            id: "ci_wiring",
            label: "CI wiring",
            status: "fail",
            message: `${workflowPath} not found`,
            remediation: "Run: npx evalgate init  (generates the workflow file)",
            ciInfo: { workflowPath, exists: false },
        };
    }
    // Basic sanity: check it references evalgate or evalgate SDK
    let content;
    try {
        content = fs.readFileSync(absPath, "utf-8");
    }
    catch {
        return {
            id: "ci_wiring",
            label: "CI wiring",
            status: "fail",
            message: `${workflowPath} exists but cannot be read`,
            remediation: "Check file permissions",
            ciInfo: { workflowPath, exists: true },
        };
    }
    if (!content.includes("evalgate") &&
        !content.includes("@evalgate/sdk") &&
        !content.includes("evalai")) {
        return {
            id: "ci_wiring",
            label: "CI wiring",
            status: "warn",
            message: `${workflowPath} exists but does not reference evalgate`,
            remediation: "Verify the workflow runs: npx -y @evalgate/sdk@^2 gate --format github",
            ciInfo: { workflowPath, exists: true },
        };
    }
    return {
        id: "ci_wiring",
        label: "CI wiring",
        status: "pass",
        message: `${workflowPath} present and references evalgate`,
        ciInfo: { workflowPath, exists: true },
    };
}
function checkProviderEnv() {
    const providers = [
        { name: "OpenAI", envVar: "OPENAI_API_KEY" },
        { name: "Anthropic", envVar: "ANTHROPIC_API_KEY" },
        { name: "Azure OpenAI", envVar: "AZURE_OPENAI_API_KEY" },
    ];
    const found = providers.filter((p) => !!process.env[p.envVar]);
    if (found.length === 0) {
        return {
            id: "provider_env",
            label: "Provider env vars",
            status: "skip",
            message: "No model provider env vars detected (optional — needed only for LLM-as-judge evals)",
        };
    }
    return {
        id: "provider_env",
        label: "Provider env vars",
        status: "pass",
        message: `Found: ${found.map((p) => p.name).join(", ")}`,
    };
}
function checkReplayDecisionReadiness(cwd, config) {
    // Check if budget is configured
    const hasBudgetConfig = config?.normalizedBudget;
    if (!hasBudgetConfig) {
        return {
            id: "replay_decision_readiness",
            label: "Replay-decision readiness",
            status: "skip",
            message: "No budget configuration found - replay-decision not applicable",
        };
    }
    // Check if baseline run exists for comparison
    const runsDir = path.join(cwd, ".evalgate", "runs");
    try {
        if (!fs.existsSync(runsDir)) {
            return {
                id: "replay_decision_readiness",
                label: "Replay-decision readiness",
                status: "warn",
                message: "Budget configured but no previous runs found in .evalgate/runs/",
                remediation: "Run at least one evaluation before using replay-decision command",
            };
        }
        const runFiles = fs
            .readdirSync(runsDir)
            .filter((f) => f.endsWith(".json"));
        if (runFiles.length === 0) {
            return {
                id: "replay_decision_readiness",
                label: "Replay-decision readiness",
                status: "warn",
                message: "Budget configured but no run artifacts found in .evalgate/runs/",
                remediation: "Run at least one evaluation before using replay-decision command",
            };
        }
        return {
            id: "replay_decision_readiness",
            label: "Replay-decision readiness",
            status: "pass",
            message: `Found ${runFiles.length} run(s) available for replay-decision comparison`,
        };
    }
    catch (_error) {
        return {
            id: "replay_decision_readiness",
            label: "Replay-decision readiness",
            status: "fail",
            message: "Unable to check .evalgate/runs/ directory",
            remediation: "Ensure .evalgate/runs/ directory is accessible",
        };
    }
}
// ── Output formatting ──
function icon(status) {
    switch (status) {
        case "pass":
            return "\u2705"; // ✅
        case "fail":
            return "\u274C"; // ❌
        case "warn":
            return "\u26A0\uFE0F"; // ⚠️
        case "skip":
            return "\u23ED\uFE0F"; // ⏭️
    }
}
function printHuman(checks, overall) {
    console.log("\n  evalgate doctor\n");
    for (const c of checks) {
        console.log(`  ${icon(c.status)} ${c.label}: ${c.message}`);
        if (c.remediation && (c.status === "fail" || c.status === "warn")) {
            console.log(`    \u2192 ${c.remediation}`);
        }
    }
    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.filter((c) => c.status === "fail").length;
    const warned = checks.filter((c) => c.status === "warn").length;
    const skipped = checks.filter((c) => c.status === "skip").length;
    console.log("");
    if (overall === "ready") {
        console.log(`  \u2705 Ready (${passed} passed${warned ? `, ${warned} warnings` : ""}${skipped ? `, ${skipped} skipped` : ""})`);
    }
    else {
        console.log(`  \u274C Not ready (${failed} failed, ${passed} passed${warned ? `, ${warned} warnings` : ""}${skipped ? `, ${skipped} skipped` : ""})`);
    }
    console.log("");
}
// ── Main ──
async function runDoctor(argv) {
    const flags = parseFlags(argv);
    const cwd = process.cwd();
    const checks = [];
    let infraError = false;
    // 1. Project detection
    checks.push(checkProject(cwd));
    // 2. Config
    const configResult = checkConfig(cwd);
    checks.push(configResult);
    // 3. Judge config
    const judgeResult = checkJudgeConfig(cwd, configResult.config);
    checks.push(judgeResult);
    // 4. Baseline
    const baselineResult = checkBaseline(cwd);
    checks.push(baselineResult);
    // 5. Auth
    checks.push(checkAuth(flags.apiKey));
    // 6. Eval target
    checks.push(checkEvalTarget(flags.evaluationId));
    // 7. Connectivity (async)
    let connectivityResult;
    try {
        connectivityResult = await checkConnectivity(flags.baseUrl, flags.apiKey);
        checks.push(connectivityResult);
    }
    catch {
        checks.push({
            id: "connectivity",
            label: "API connectivity",
            status: "fail",
            message: "Infrastructure error during connectivity check",
        });
        infraError = true;
        connectivityResult = {
            id: "connectivity",
            label: "API connectivity",
            status: "fail",
            message: "",
        };
    }
    // 8. Eval access (async, depends on auth + connectivity)
    if (flags.apiKey &&
        flags.evaluationId &&
        connectivityResult.status !== "fail") {
        try {
            const accessResult = await checkEvalAccess(flags.baseUrl, flags.apiKey, flags.evaluationId, flags.baseline);
            checks.push(accessResult);
            if (judgeResult.judgeInfo.configured) {
                checks.push(...checkJudgeCredibilityWarnings(accessResult.quality));
            }
        }
        catch {
            checks.push({
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: "Infrastructure error during access check",
            });
            infraError = true;
        }
    }
    else {
        checks.push({
            id: "eval_access",
            label: "Evaluation access",
            status: "skip",
            message: "Skipped (prerequisite check failed)",
        });
    }
    // 9. CI wiring
    const ciResult = checkCiWiring(cwd);
    checks.push(ciResult);
    // 10. Golden set health
    checks.push(checkGoldenSetHealth(cwd, configResult.config));
    // 11. Provider env vars
    checks.push(checkProviderEnv());
    // 12. Replay-decision validation
    checks.push(checkReplayDecisionReadiness(cwd, configResult.config));
    // Determine overall status
    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    const effectiveFail = hasFail || (flags.strict && hasWarn);
    const overall = infraError
        ? "infra_error"
        : effectiveFail
            ? "not_ready"
            : "ready";
    // --report: JSON diagnostic bundle
    if (flags.report || flags.format === "json") {
        const redactedConfig = {
            ...(configResult.config ?? {}),
            path: configResult.configPath
                ? path.relative(cwd, configResult.configPath)
                : null,
        };
        const bundle = {
            timestamp: new Date().toISOString(),
            cliVersion: version_1.SDK_VERSION,
            specVersion: version_1.SPEC_VERSION,
            platform: `${process.platform}/${process.arch}`,
            nodeVersion: process.version,
            checks,
            config: redactedConfig,
            baseline: baselineResult.baselineInfo,
            api: {
                reachable: connectivityResult.status === "pass" ||
                    connectivityResult.status === "warn",
                latencyMs: connectivityResult.latencyMs,
            },
            ci: ciResult.ciInfo,
            judge: judgeResult.judgeInfo,
            overall,
        };
        console.log(JSON.stringify(bundle, null, 2));
    }
    else {
        printHuman(checks, overall);
    }
    // Exit code
    if (infraError)
        return exports.DOCTOR_EXIT.INFRA_ERROR;
    if (effectiveFail)
        return exports.DOCTOR_EXIT.NOT_READY;
    return exports.DOCTOR_EXIT.READY;
}
