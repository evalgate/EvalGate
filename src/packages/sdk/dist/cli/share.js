"use strict";
/**
 * evalgate share — Create a share link for a run.
 * Usage: evalgate share --scope run --expires 7d
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseShareArgs = parseShareArgs;
exports.runShare = runShare;
const api_1 = require("./api");
function parseExpires(spec) {
    const m = spec.match(/^(\d+)(d|h|m|s)$/i);
    if (!m)
        return null;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    if (unit === "d")
        return n;
    if (unit === "h")
        return n / 24;
    if (unit === "m")
        return n / (24 * 60);
    if (unit === "s")
        return n / (24 * 60 * 60);
    return null;
}
function parseShareArgs(argv) {
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
    const baseUrl = args.baseUrl ||
        process.env.EVALGATE_BASE_URL ||
        process.env.EVALAI_BASE_URL ||
        "http://localhost:3000";
    const apiKey = args.apiKey ||
        process.env.EVALGATE_API_KEY ||
        process.env.EVALAI_API_KEY ||
        "";
    const evaluationId = args.evaluationId || "";
    const runId = args.runId ? parseInt(args.runId, 10) : NaN;
    const scope = args.scope === "run" ? "run" : "run";
    const expires = args.expires || "7d";
    if (!apiKey)
        return { error: "Error: --apiKey or EVALGATE_API_KEY is required" };
    if (!evaluationId)
        return { error: "Error: --evaluationId is required" };
    if (Number.isNaN(runId) || runId < 1)
        return {
            error: "Error: --runId is required and must be a positive number",
        };
    const expiresInDays = parseExpires(expires);
    if (expiresInDays == null || expiresInDays <= 0)
        return { error: "Error: --expires must be e.g. 7d, 24h, 60m, 1s" };
    return {
        baseUrl,
        apiKey,
        evaluationId,
        runId,
        scope,
        expires,
        expiresInDays,
    };
}
async function runShare(args) {
    const exportRes = await (0, api_1.fetchRunExport)(args.baseUrl, args.apiKey, args.evaluationId, args.runId);
    if (!exportRes.ok) {
        console.error(`EvalGate share: failed to fetch export — ${exportRes.status} ${exportRes.body}`);
        return 1;
    }
    const publishRes = await (0, api_1.publishShare)(args.baseUrl, args.apiKey, args.evaluationId, exportRes.exportData, args.runId, { expiresInDays: args.expiresInDays });
    if (!publishRes.ok) {
        console.error(`EvalGate share: failed to publish — ${publishRes.status} ${publishRes.body}`);
        return 1;
    }
    const shareUrl = publishRes.data.shareUrl ??
        `${args.baseUrl.replace(/\/$/, "")}/share/${publishRes.data.shareId}`;
    console.log(`Share link created (expires in ${args.expires}):`);
    console.log(shareUrl);
    return 0;
}
