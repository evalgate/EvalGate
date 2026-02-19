"use strict";
/**
 * evalai doctor — Verify CI/CD setup.
 * Uses the same quality endpoint as check — if doctor passes, check works.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDoctor = runDoctor;
const api_1 = require("./api");
const config_1 = require("./config");
function parseDoctorArgs(argv) {
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
    const baseUrl = args.baseUrl || process.env.EVALAI_BASE_URL || "http://localhost:3000";
    const apiKey = args.apiKey || process.env.EVALAI_API_KEY || "";
    let evaluationId = args.evaluationId || "";
    const baseline = (args.baseline === "previous"
        ? "previous"
        : args.baseline === "production"
            ? "production"
            : "published");
    if (!evaluationId) {
        const config = (0, config_1.loadConfig)(process.cwd());
        const merged = (0, config_1.mergeConfigWithArgs)(config, {
            evaluationId: args.evaluationId,
            baseUrl: args.baseUrl || process.env.EVALAI_BASE_URL,
            baseline: args.baseline,
        });
        if (merged.evaluationId)
            evaluationId = String(merged.evaluationId);
    }
    if (!apiKey) {
        return { ok: false, message: "Set EVALAI_API_KEY" };
    }
    if (!evaluationId) {
        const configPath = (0, config_1.findConfigPath)(process.cwd());
        if (!configPath) {
            return { ok: false, message: "Run npx evalai init" };
        }
        return { ok: false, message: "Set evaluationId in evalai.config.json" };
    }
    return { baseUrl, apiKey, evaluationId, baseline };
}
async function runDoctor(argv) {
    const parsed = parseDoctorArgs(argv);
    if (!("baseUrl" in parsed)) {
        console.error(parsed.message);
        return 1;
    }
    const args = parsed;
    // Call exact quality endpoint: GET /api/quality?action=latest&evaluationId=&baseline=
    const result = await (0, api_1.fetchQualityLatest)(args.baseUrl, args.apiKey, args.evaluationId, args.baseline);
    if (!result.ok) {
        if (result.status === 0) {
            console.error(`Quality API: Network failure — ${result.body}`);
        }
        else {
            console.error(`Quality API: ${result.status} — ${result.body}`);
        }
        return 1;
    }
    const { data } = result;
    // Baseline: if quality returns baselineMissing, suggest fix
    if (data.baselineMissing === true) {
        console.error("Publish a run or use --baseline previous");
        return 1;
    }
    console.log("✓ EvalAI doctor: OK");
    return 0;
}
