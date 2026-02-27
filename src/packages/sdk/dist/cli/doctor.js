"use strict";
/**
 * evalai doctor — Comprehensive CI/CD readiness checklist.
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
 *   --apiKey <key>    API key (or EVALAI_API_KEY env)
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
exports.checkProject = checkProject;
exports.checkConfig = checkConfig;
exports.checkBaseline = checkBaseline;
exports.checkAuth = checkAuth;
exports.checkConnectivity = checkConnectivity;
exports.checkEvalTarget = checkEvalTarget;
exports.checkEvalAccess = checkEvalAccess;
exports.checkCiWiring = checkCiWiring;
exports.checkProviderEnv = checkProviderEnv;
exports.runDoctor = runDoctor;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const version_1 = require("../version");
const api_1 = require("./api");
const config_1 = require("./config");
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
    const baseUrl = raw.baseUrl || process.env.EVALAI_BASE_URL || "http://localhost:3000";
    const apiKey = raw.apiKey || process.env.EVALAI_API_KEY || "";
    let evaluationId = raw.evaluationId || "";
    const baseline = (raw.baseline === "previous" ? "previous"
        : raw.baseline === "production" ? "production"
            : "published");
    // Try to fill evaluationId from config
    if (!evaluationId) {
        const config = (0, config_1.loadConfig)(process.cwd());
        const merged = (0, config_1.mergeConfigWithArgs)(config, {
            evaluationId: raw.evaluationId,
            baseUrl: raw.baseUrl || process.env.EVALAI_BASE_URL,
            baseline: raw.baseline,
        });
        if (merged.evaluationId)
            evaluationId = String(merged.evaluationId);
    }
    const strict = raw.strict === "true" || raw.strict === "1";
    return { report, format: report ? "json" : fmt, strict, baseUrl, apiKey, evaluationId, baseline };
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
            message: "No evalai.config.json found",
            remediation: "Run: npx evalai init",
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
            remediation: "Fix JSON syntax in your config file, or delete it and run: npx evalai init",
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
            remediation: "Add evaluationId to evalai.config.json (from the dashboard) or ensure gate.baseline is set",
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
            remediation: "Run: npx evalai init  (or: npx evalai baseline init)",
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
            remediation: "Delete evals/baseline.json and run: npx evalai baseline init",
            baselineInfo: { path: "evals/baseline.json", exists: true },
        };
    }
    const schemaVersion = typeof data.schemaVersion === "number" ? data.schemaVersion : undefined;
    const hash = (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 12);
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
            remediation: "Run: npx evalai baseline init  (creates schemaVersion 1)",
            baselineInfo: { path: "evals/baseline.json", exists: true, hash, schemaVersion },
        };
    }
    if (stale) {
        return {
            id: "baseline",
            label: "Baseline file",
            status: "warn",
            message: `Baseline is stale (last updated ${updatedAt})`,
            remediation: "Run: npx evalai baseline update",
            baselineInfo: { path: "evals/baseline.json", exists: true, hash, schemaVersion, stale },
        };
    }
    return {
        id: "baseline",
        label: "Baseline file",
        status: "pass",
        message: `schemaVersion ${schemaVersion}, hash ${hash}`,
        baselineInfo: { path: "evals/baseline.json", exists: true, hash, schemaVersion, stale },
    };
}
function checkAuth(apiKey) {
    if (!apiKey) {
        return {
            id: "auth",
            label: "Authentication",
            status: "fail",
            message: "No API key found",
            remediation: "Set EVALAI_API_KEY environment variable, or pass --apiKey <key>",
        };
    }
    // Redact key for display
    const redacted = apiKey.length > 8
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
        : "****";
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
                "X-EvalAI-SDK-Version": version_1.SDK_VERSION,
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
                    : `Verify EVALAI_BASE_URL is correct (currently: ${baseUrl})`,
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
            remediation: `Verify EVALAI_BASE_URL is correct and the server is running`,
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
            remediation: "Add evaluationId to evalai.config.json, or pass --evaluationId <id>",
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
            };
        }
        if (result.status === 401 || result.status === 403) {
            return {
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: `Access denied (${result.status}) for evaluationId ${evaluationId}`,
                remediation: "Verify your API key has eval:read and runs:read scopes",
            };
        }
        if (result.status === 404) {
            return {
                id: "eval_access",
                label: "Evaluation access",
                status: "fail",
                message: `Evaluation ${evaluationId} not found`,
                remediation: "Check the evaluationId in your config matches an existing evaluation",
            };
        }
        return {
            id: "eval_access",
            label: "Evaluation access",
            status: "fail",
            message: `Quality API returned ${result.status}`,
            remediation: `API response: ${result.body?.slice(0, 200)}`,
        };
    }
    if (result.data.baselineMissing === true) {
        return {
            id: "eval_access",
            label: "Evaluation access",
            status: "warn",
            message: `Evaluation ${evaluationId} accessible, but no baseline run found`,
            remediation: "Publish a run from the dashboard, or use --baseline previous once you have runs",
        };
    }
    return {
        id: "eval_access",
        label: "Evaluation access",
        status: "pass",
        message: `Evaluation ${evaluationId} accessible, score: ${result.data.score ?? "n/a"}`,
    };
}
function checkCiWiring(cwd) {
    const workflowPath = path.join(".github", "workflows", "evalai-gate.yml");
    const absPath = path.join(cwd, workflowPath);
    if (!fs.existsSync(absPath)) {
        return {
            id: "ci_wiring",
            label: "CI wiring",
            status: "fail",
            message: `${workflowPath} not found`,
            remediation: "Run: npx evalai init  (generates the workflow file)",
            ciInfo: { workflowPath, exists: false },
        };
    }
    // Basic sanity: check it references evalai
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
    if (!content.includes("evalai") && !content.includes("@pauly4010/evalai-sdk")) {
        return {
            id: "ci_wiring",
            label: "CI wiring",
            status: "warn",
            message: `${workflowPath} exists but does not reference evalai`,
            remediation: "Verify the workflow runs: npx -y @pauly4010/evalai-sdk@^1 gate --format github",
            ciInfo: { workflowPath, exists: true },
        };
    }
    return {
        id: "ci_wiring",
        label: "CI wiring",
        status: "pass",
        message: `${workflowPath} present and references evalai`,
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
// ── Output formatting ──
function icon(status) {
    switch (status) {
        case "pass": return "\u2705"; // ✅
        case "fail": return "\u274C"; // ❌
        case "warn": return "\u26A0\uFE0F"; // ⚠️
        case "skip": return "\u23ED\uFE0F"; // ⏭️
    }
}
function printHuman(checks, overall) {
    console.log("\n  evalai doctor\n");
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
    // 3. Baseline
    const baselineResult = checkBaseline(cwd);
    checks.push(baselineResult);
    // 4. Auth
    checks.push(checkAuth(flags.apiKey));
    // 5. Eval target
    checks.push(checkEvalTarget(flags.evaluationId));
    // 6. Connectivity (async)
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
        connectivityResult = { id: "connectivity", label: "API connectivity", status: "fail", message: "" };
    }
    // 7. Eval access (async, depends on auth + connectivity)
    if (flags.apiKey && flags.evaluationId && connectivityResult.status !== "fail") {
        try {
            const accessResult = await checkEvalAccess(flags.baseUrl, flags.apiKey, flags.evaluationId, flags.baseline);
            checks.push(accessResult);
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
    // 8. CI wiring
    const ciResult = checkCiWiring(cwd);
    checks.push(ciResult);
    // 9. Provider env vars
    checks.push(checkProviderEnv());
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
            path: configResult.configPath ? path.relative(cwd, configResult.configPath) : null,
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
                reachable: connectivityResult.status === "pass" || connectivityResult.status === "warn",
                latencyMs: connectivityResult.latencyMs,
            },
            ci: ciResult.ciInfo,
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
