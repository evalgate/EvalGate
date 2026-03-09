"use strict";
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
exports.DEFAULT_LABELED_DATASET_PATH = void 0;
exports.analyzeLabeledDataset = analyzeLabeledDataset;
exports.formatAnalyzeHuman = formatAnalyzeHuman;
exports.runAnalyze = runAnalyze;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.DEFAULT_LABELED_DATASET_PATH = path.join(process.cwd(), ".evalgate", "golden", "labeled.jsonl");
function isIsoTimestamp(value) {
    return Number.isFinite(Date.parse(value));
}
function parseLabeledDataset(content) {
    const rows = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return rows.map((line, i) => {
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            throw new Error(`Invalid JSONL at line ${i + 1}: expected valid JSON object`);
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error(`Invalid JSONL at line ${i + 1}: expected JSON object record`);
        }
        const record = parsed;
        const caseId = record.caseId;
        const input = record.input;
        const expected = record.expected;
        const actual = record.actual;
        const label = record.label;
        const failureMode = record.failureMode;
        const labeledAt = record.labeledAt;
        if (typeof caseId !== "string" || caseId.trim().length === 0) {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: caseId must be a non-empty string`);
        }
        if (typeof input !== "string") {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: input must be a string`);
        }
        if (typeof expected !== "string") {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: expected must be a string`);
        }
        if (typeof actual !== "string") {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: actual must be a string`);
        }
        if (label !== "pass" && label !== "fail") {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: label must be "pass" or "fail"`);
        }
        if (!(typeof failureMode === "string" || failureMode === null)) {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: failureMode must be string or null`);
        }
        if (label === "fail" && (!failureMode || failureMode.trim().length === 0)) {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: failed rows require a non-empty failureMode`);
        }
        if (label === "pass" &&
            typeof failureMode === "string" &&
            failureMode.trim().length > 0) {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: passing rows must set failureMode to null or empty string`);
        }
        if (typeof labeledAt !== "string" || !isIsoTimestamp(labeledAt)) {
            throw new Error(`Invalid labeled dataset at line ${i + 1}: labeledAt must be an ISO timestamp string`);
        }
        return {
            caseId,
            input,
            expected,
            actual,
            label,
            failureMode,
            labeledAt,
        };
    });
}
function classifyFailureMode(item) {
    if (item.failureMode && item.failureMode.trim().length > 0) {
        return item.failureMode.trim();
    }
    return "failed_without_mode";
}
function analyzeLabeledDataset(rows, top) {
    const total = rows.length;
    const failedItems = rows.filter((r) => r.label === "fail");
    const failed = failedItems.length;
    const passRate = total > 0 ? (total - failed) / total : 0;
    const counts = new Map();
    for (const item of failedItems) {
        const mode = classifyFailureMode(item);
        counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
    const failureModes = [...counts.entries()]
        .map(([mode, count]) => ({
        mode,
        count,
        frequency: failed > 0 ? count / failed : 0,
    }))
        .sort((a, b) => b.count - a.count || a.mode.localeCompare(b.mode))
        .slice(0, Math.max(1, top));
    return { total, failed, passRate, failureModes };
}
function formatAnalyzeHuman(summary) {
    const lines = [];
    lines.push("Analyze phase (first pass)");
    lines.push(`Total cases: ${summary.total}`);
    lines.push(`Failed: ${summary.failed} (${(summary.total > 0 ? (summary.failed / summary.total) * 100 : 0).toFixed(1)}%)`);
    lines.push(`Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
    if (summary.failureModes.length === 0) {
        lines.push("Failure modes: none");
        return lines.join("\n");
    }
    lines.push("Top failure modes:");
    for (const [index, mode] of summary.failureModes.entries()) {
        lines.push(`${index + 1}. ${mode.mode} — ${mode.count} (${(mode.frequency * 100).toFixed(1)}%)`);
    }
    return lines.join("\n");
}
function parseAnalyzeArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--"))
            continue;
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
    const topRaw = parseInt(args.top ?? "5", 10);
    return {
        datasetPath: args.dataset || exports.DEFAULT_LABELED_DATASET_PATH,
        format: args.format === "json" ? "json" : "human",
        top: Number.isNaN(topRaw) || topRaw < 1 ? 5 : topRaw,
    };
}
function runAnalyze(argv) {
    const options = parseAnalyzeArgs(argv);
    let rows;
    try {
        const raw = fs.readFileSync(options.datasetPath, "utf8");
        rows = parseLabeledDataset(raw);
    }
    catch (error) {
        console.error(`EvalGate analyze ERROR: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
    }
    const summary = analyzeLabeledDataset(rows, options.top);
    if (options.format === "json") {
        console.log(JSON.stringify(summary));
    }
    else {
        console.log(formatAnalyzeHuman(summary));
    }
    return 0;
}
