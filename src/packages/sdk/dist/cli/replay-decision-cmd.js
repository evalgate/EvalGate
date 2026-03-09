#!/usr/bin/env node
"use strict";
/**
 * evalgate replay-decision — Compare two runs and make keep/discard decisions
 *
 * Usage:
 *   evalgate replay-decision --previous run-123.json --current run-456.json
 *   evalgate replay-decision --baseline latest --current run-456.json
 *
 * Exit codes:
 *   0 — Decision: KEEP (pass rate improved within budget)
 *   1 — Decision: DISCARD (pass rate declined or budget exceeded)
 *   2 — Error (invalid inputs, missing files, etc.)
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
exports.runReplayDecision = runReplayDecision;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const config_1 = require("./config");
const replay_decision_1 = require("./replay-decision");
function parseReplayDecisionArgs(argv) {
    try {
        const { values } = (0, node_util_1.parseArgs)({
            args: argv,
            options: {
                previous: { type: "string" },
                current: { type: "string" },
                format: { type: "string", default: "human" },
            },
            strict: true,
        });
        const previous = values.previous;
        const current = values.current;
        const format = values.format;
        if (!previous) {
            return { error: "--previous is required", exitCode: 2 };
        }
        if (!current) {
            return { error: "--current is required", exitCode: 2 };
        }
        if (!["human", "json"].includes(format)) {
            return { error: "--format must be 'human' or 'json'", exitCode: 2 };
        }
        return { previous, current, format: format };
    }
    catch (error) {
        return {
            error: error instanceof Error ? error.message : "Invalid arguments",
            exitCode: 2,
        };
    }
}
async function loadRunResult(filePath) {
    const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);
    try {
        const content = await fs.readFile(resolved, "utf-8");
        const parsed = JSON.parse(content);
        // Validate basic structure
        if (!parsed.schemaVersion || !parsed.results || !parsed.summary) {
            throw new Error("Invalid run result format");
        }
        return parsed;
    }
    catch (error) {
        throw new Error(`Failed to load run result from ${filePath}: ${error}`);
    }
}
async function findLatestRun(projectRoot) {
    const runsDir = path.join(projectRoot, ".evalgate", "runs");
    try {
        const files = await fs.readdir(runsDir);
        const runFiles = files
            .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
            .map((f) => path.join(runsDir, f));
        if (runFiles.length === 0) {
            throw new Error("No run files found");
        }
        // Get file stats to find the most recent
        const stats = await Promise.all(runFiles.map(async (file) => ({
            file,
            mtime: (await fs.stat(file)).mtime,
        })));
        stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        return stats[0].file;
    }
    catch (error) {
        throw new Error(`Failed to find latest run: ${error}`);
    }
}
function formatHumanOutput(decision) {
    const { action, reason, budgetUsed, budgetLimit, comparisonBasis } = decision;
    const actionIcon = action === "keep" ? "✅" : "❌";
    const budgetBar = `${budgetUsed}/${budgetLimit}`;
    let output = `\n${actionIcon} Replay Decision: ${action.toUpperCase()}\n`;
    output += `📊 Reason: ${reason}\n`;
    output += `💰 Budget: ${budgetBar}\n`;
    output += `📈 Comparison: ${comparisonBasis} pass rate\n`;
    output += `📊 Previous: ${(decision.previousPassRate * 100).toFixed(1)}%`;
    if (decision.previousCorrectedPassRate !== null) {
        output += ` (corrected: ${(decision.previousCorrectedPassRate * 100).toFixed(1)}%)`;
    }
    output += `\n📊 Current: ${(decision.newPassRate * 100).toFixed(1)}%`;
    if (decision.newCorrectedPassRate !== null) {
        output += ` (corrected: ${(decision.newCorrectedPassRate * 100).toFixed(1)}%)`;
    }
    output += `\n`;
    return output;
}
async function runReplayDecision(argv) {
    const args = parseReplayDecisionArgs(argv);
    if ("error" in args) {
        console.error(`Error: ${args.error}`);
        return args.exitCode;
    }
    const projectRoot = process.cwd();
    const config = (0, config_1.loadConfig)(projectRoot);
    try {
        // Load current run
        const currentRun = await loadRunResult(args.current);
        // Load previous run (handle "latest" special case)
        let previousPath = args.previous;
        if (args.previous === "latest") {
            previousPath = await findLatestRun(projectRoot);
        }
        const previousRun = await loadRunResult(previousPath);
        // Validate budget config exists
        if (!config?.normalizedBudget) {
            console.error("Error: No normalized budget config found in evalgate.config.json");
            return 2;
        }
        // Make replay decision
        const decision = (0, replay_decision_1.evaluateReplayOutcome)(previousRun, currentRun, config.normalizedBudget);
        // Output results
        if (args.format === "json") {
            console.log(JSON.stringify(decision, null, 2));
        }
        else {
            console.log(formatHumanOutput(decision));
        }
        // Return appropriate exit code
        return decision.action === "keep" ? 0 : 1;
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
    }
}
// Run if called directly
if (require.main === module) {
    runReplayDecision(process.argv.slice(2)).then((code) => process.exit(code));
}
