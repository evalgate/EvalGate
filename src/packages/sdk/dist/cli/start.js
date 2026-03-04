"use strict";
/**
 * evalgate start — Zero-config startup
 *
 * One command to go from nothing to a passing eval run:
 *   npx evalgate start
 *
 * What it does:
 *   1. If no evalgate.config.json, runs init
 *   2. If no manifest, runs discover --manifest
 *   3. Runs evalgate run --write-results
 *   4. Prints results
 *
 * The goal: zero decisions, one command, immediate value.
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
exports.runStart = runStart;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const discover_1 = require("./discover");
const init_1 = require("./init");
const run_1 = require("./run");
/**
 * Zero-config startup: one command → passing run
 */
async function runStart(options = {}, projectRoot = process.cwd()) {
    const format = options.format ?? "human";
    if (format === "human") {
        console.log("\n🚀 evalgate start — zero-config evaluation run\n");
    }
    // Step 1: Ensure project is initialized
    const configPath = path.join(projectRoot, "evalgate.config.json");
    if (!fs.existsSync(configPath) && !options.skipInit) {
        if (format === "human") {
            console.log("📦 No evalgate.config.json found. Initializing...\n");
        }
        const initOk = (0, init_1.runInit)(projectRoot);
        if (!initOk) {
            console.error("❌ Initialization failed. Run `evalgate init` manually.");
            return 1;
        }
        if (format === "human")
            console.log("");
    }
    // Step 2: Ensure manifest exists (discover specs)
    const manifestPath = path.join(projectRoot, ".evalgate", "manifest.json");
    if (!fs.existsSync(manifestPath)) {
        if (format === "human") {
            console.log("🔍 No manifest found. Discovering specs...\n");
        }
        try {
            await (0, discover_1.discoverSpecs)({ manifest: true });
        }
        catch (err) {
            // Discovery may fail if no spec files exist yet — that's OK for legacy mode
            if (format === "human") {
                console.log(`   ℹ️  Discovery: ${err instanceof Error ? err.message : String(err)}`);
                console.log("   Falling back to gate mode...\n");
            }
        }
    }
    // Step 3: Run evaluations
    if (format === "human") {
        console.log("▶️  Running evaluations...\n");
    }
    try {
        const result = await (0, run_1.runEvaluations)({ writeResults: true, format }, projectRoot);
        if (format === "json") {
            (0, run_1.printJsonResults)(result);
        }
        else {
            (0, run_1.printHumanResults)(result);
        }
        // Step 4: If watch mode requested, transition to watch
        if (options.watch) {
            const { runWatch } = await Promise.resolve().then(() => __importStar(require("./watch")));
            await runWatch({ writeResults: true, format }, projectRoot);
            return 0; // Never reached (watch runs forever)
        }
        return result.summary.failed > 0 ? 1 : 0;
    }
    catch (error) {
        if (format === "human") {
            console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
            console.log("\n💡 Tips:");
            console.log("   • Create spec files with defineEval() in eval/ directory");
            console.log("   • Run `evalgate discover` to verify spec detection");
            console.log("   • Run `evalgate doctor` for full diagnostics");
        }
        else {
            console.error(JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
            }));
        }
        return 1;
    }
}
