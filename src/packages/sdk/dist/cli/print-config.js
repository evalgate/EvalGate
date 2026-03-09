"use strict";
/**
 * evalgate print-config — Show resolved configuration with source-of-truth annotations.
 *
 * Prints every config field, where it came from (file, env, default, CLI arg),
 * and redacts secrets. Useful for debugging "why is it using this baseUrl?"
 *
 * Usage:
 *   evalgate print-config
 *   evalgate print-config --format json
 *
 * Exit codes:
 *   0 — Always (informational only)
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
exports.runPrintConfig = runPrintConfig;
const path = __importStar(require("node:path"));
const version_1 = require("../version");
const config_1 = require("./config");
const profiles_1 = require("./profiles");
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
    return {
        format: raw.format === "json" ? "json" : "human",
        evaluationId: raw.evaluationId,
        baseUrl: raw.baseUrl,
        apiKey: raw.apiKey,
        baseline: raw.baseline,
        profile: raw.profile,
        minScore: raw.minScore,
        maxDrop: raw.maxDrop,
        warnDrop: raw.warnDrop,
        minN: raw.minN,
    };
}
// ── Helpers ──
function redact(value) {
    if (!value)
        return null;
    if (value.length > 8)
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    return "****";
}
// ── Build resolved config ──
function buildResolvedConfig(cwd, flags) {
    const configPath = (0, config_1.findConfigPath)(cwd);
    const fileConfig = (0, config_1.loadConfig)(cwd);
    // Build CLI args object (only what was explicitly passed)
    const cliArgs = {};
    if (flags.evaluationId)
        cliArgs.evaluationId = flags.evaluationId;
    if (flags.baseUrl)
        cliArgs.baseUrl = flags.baseUrl;
    if (flags.baseline)
        cliArgs.baseline = flags.baseline;
    if (flags.profile)
        cliArgs.profile = flags.profile;
    if (flags.minScore)
        cliArgs.minScore = flags.minScore;
    if (flags.maxDrop)
        cliArgs.maxDrop = flags.maxDrop;
    if (flags.warnDrop)
        cliArgs.warnDrop = flags.warnDrop;
    if (flags.minN)
        cliArgs.minN = flags.minN;
    const merged = (0, config_1.mergeConfigWithArgs)(fileConfig, cliArgs);
    // Determine source of each field
    const fields = [];
    // evaluationId
    const evalIdSource = flags.evaluationId
        ? "arg"
        : fileConfig?.evaluationId
            ? "file"
            : "default";
    fields.push({
        key: "evaluationId",
        value: merged.evaluationId ?? null,
        source: evalIdSource,
    });
    // baseUrl
    const envBaseUrl = process.env.EVALGATE_BASE_URL;
    const baseUrlSource = flags.baseUrl
        ? "arg"
        : envBaseUrl
            ? "env"
            : fileConfig?.baseUrl
                ? "file"
                : "default";
    fields.push({
        key: "baseUrl",
        value: flags.baseUrl ||
            envBaseUrl ||
            fileConfig?.baseUrl ||
            "https://api.evalgate.com",
        source: baseUrlSource,
    });
    // apiKey (always redacted)
    const envApiKey = process.env.EVALGATE_API_KEY;
    const rawApiKey = flags.apiKey || envApiKey || "";
    const apiKeySource = flags.apiKey
        ? "arg"
        : envApiKey
            ? "env"
            : "default";
    fields.push({
        key: "apiKey",
        value: redact(rawApiKey) ?? "(not set)",
        source: apiKeySource,
        raw: rawApiKey ? "(redacted)" : undefined,
    });
    // profile
    const profileName = (flags.profile || fileConfig?.profile);
    const profileSource = flags.profile
        ? "arg"
        : fileConfig?.profile
            ? "file"
            : "default";
    fields.push({
        key: "profile",
        value: profileName ?? null,
        source: profileSource,
    });
    // Numeric gate fields: minScore, maxDrop, warnDrop, minN, allowWeakEvidence
    const numericFields = [
        { key: "minScore" },
        { key: "maxDrop" },
        { key: "warnDrop" },
        { key: "minN" },
        { key: "allowWeakEvidence" },
    ];
    for (const { key } of numericFields) {
        const argVal = cliArgs[key];
        const fileVal = fileConfig?.[key];
        const profileVal = profileName && profileName in profiles_1.PROFILES
            ? profiles_1.PROFILES[profileName][key]
            : undefined;
        const source = argVal !== undefined
            ? "arg"
            : fileVal !== undefined
                ? "file"
                : profileVal !== undefined
                    ? "profile"
                    : "default";
        fields.push({
            key,
            value: merged[key] ?? null,
            source,
        });
    }
    // baseline
    const baselineSource = flags.baseline
        ? "arg"
        : fileConfig?.baseline
            ? "file"
            : "default";
    fields.push({
        key: "baseline",
        value: merged.baseline ?? "published",
        source: baselineSource,
    });
    // judge.* fields (P1 scaffolding visibility)
    const judgeSource = fileConfig?.judge ? "file" : "default";
    fields.push({
        key: "judge.labeledDatasetPath",
        value: merged.judge?.labeledDatasetPath ?? null,
        source: judgeSource,
    });
    fields.push({
        key: "judge.bootstrapIterations",
        value: merged.judge?.bootstrapIterations ?? null,
        source: judgeSource,
    });
    fields.push({
        key: "judge.bootstrapSeed",
        value: merged.judge?.bootstrapSeed ?? null,
        source: judgeSource,
    });
    fields.push({
        key: "judge.split",
        value: merged.judge?.split ? JSON.stringify(merged.judge.split) : null,
        source: judgeSource,
    });
    fields.push({
        key: "judge.alignmentThresholds",
        value: merged.judge?.alignmentThresholds
            ? JSON.stringify(merged.judge.alignmentThresholds)
            : null,
        source: judgeSource,
    });
    // Environment variables summary
    const envVars = {
        EVALGATE_API_KEY: redact(envApiKey),
        EVALGATE_BASE_URL: envBaseUrl ?? null,
        OPENAI_API_KEY: redact(process.env.OPENAI_API_KEY),
        ANTHROPIC_API_KEY: redact(process.env.ANTHROPIC_API_KEY),
        AZURE_OPENAI_API_KEY: redact(process.env.AZURE_OPENAI_API_KEY),
        GITHUB_ACTIONS: process.env.GITHUB_ACTIONS ?? null,
        CI: process.env.CI ?? null,
    };
    return {
        cliVersion: version_1.SDK_VERSION,
        configFile: configPath ? path.relative(cwd, configPath) : null,
        cwd,
        resolved: fields,
        env: envVars,
    };
}
// ── Output formatting ──
function printHuman(output) {
    console.log("\n  evalgate print-config\n");
    console.log(`  CLI version: ${output.cliVersion}`);
    console.log(`  Config file: ${output.configFile ?? "(none found)"}`);
    console.log(`  Working dir: ${output.cwd}`);
    console.log("");
    console.log("  Resolved configuration:");
    console.log("");
    const maxKeyLen = Math.max(...output.resolved.map((f) => f.key.length));
    for (const field of output.resolved) {
        const val = field.value === null ? "(not set)" : String(field.value);
        const pad = " ".repeat(maxKeyLen - field.key.length);
        const sourceTag = `[${field.source}]`;
        console.log(`    ${field.key}${pad}  ${val}  ${sourceTag}`);
    }
    console.log("");
    console.log("  Environment variables:");
    console.log("");
    for (const [key, val] of Object.entries(output.env)) {
        if (val !== null) {
            console.log(`    ${key} = ${val}`);
        }
    }
    const unsetEnv = Object.entries(output.env)
        .filter(([, v]) => v === null)
        .map(([k]) => k);
    if (unsetEnv.length > 0) {
        console.log(`    (not set: ${unsetEnv.join(", ")})`);
    }
    console.log("");
}
// ── Main ──
function runPrintConfig(argv) {
    const flags = parseFlags(argv);
    const cwd = process.cwd();
    const output = buildResolvedConfig(cwd, flags);
    if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2));
    }
    else {
        printHuman(output);
    }
    return 0;
}
