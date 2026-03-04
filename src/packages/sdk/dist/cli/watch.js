"use strict";
/**
 * Watch mode for evalgate run
 *
 * Re-executes evaluation specs when source files change.
 * Uses Node.js fs.watch with debouncing to avoid rapid re-runs.
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
exports.runWatch = runWatch;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const run_1 = require("./run");
/**
 * Start watch mode — runs evaluations and re-runs on file changes
 */
async function runWatch(options, projectRoot = process.cwd()) {
    const debounceMs = options.debounceMs ?? 300;
    const clearScreen = options.clearScreen ?? true;
    // Directories to watch
    const watchDirs = new Set();
    // Always watch the eval/ directory if it exists
    const evalDir = path.join(projectRoot, "eval");
    if (fs.existsSync(evalDir))
        watchDirs.add(evalDir);
    // Watch evals/ directory too
    const evalsDir = path.join(projectRoot, "evals");
    if (fs.existsSync(evalsDir))
        watchDirs.add(evalsDir);
    // Watch src/ for code changes that may affect evals
    const srcDir = path.join(projectRoot, "src");
    if (fs.existsSync(srcDir))
        watchDirs.add(srcDir);
    // Add extra watch dirs
    if (options.extraWatchDirs) {
        for (const dir of options.extraWatchDirs) {
            const resolved = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
            if (fs.existsSync(resolved))
                watchDirs.add(resolved);
        }
    }
    if (watchDirs.size === 0) {
        console.error("❌ No directories to watch. Create eval/, evals/, or src/ directory.");
        process.exit(1);
    }
    console.log("👁️  Watch mode enabled");
    console.log(`   Watching: ${[...watchDirs].map((d) => path.relative(projectRoot, d) || ".").join(", ")}`);
    console.log(`   Debounce: ${debounceMs}ms`);
    console.log("   Press Ctrl+C to stop\n");
    // Initial run
    await executeRun(options, projectRoot, clearScreen, false);
    // Set up watchers with debouncing
    let debounceTimer = null;
    let isRunning = false;
    const triggerRun = () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (isRunning)
                return;
            isRunning = true;
            try {
                await executeRun(options, projectRoot, clearScreen, true);
            }
            finally {
                isRunning = false;
            }
        }, debounceMs);
    };
    const watchers = [];
    for (const dir of watchDirs) {
        try {
            const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
                if (!filename)
                    return;
                // Skip hidden files and node_modules
                if (filename.startsWith(".") || filename.includes("node_modules"))
                    return;
                // Only watch relevant file types
                const ext = path.extname(filename).toLowerCase();
                if ([".ts", ".tsx", ".js", ".jsx", ".json", ".jsonl", ".csv"].includes(ext)) {
                    console.log(`\n🔄 Change detected: ${filename} (${eventType})`);
                    triggerRun();
                }
            });
            watchers.push(watcher);
        }
        catch (err) {
            console.warn(`⚠️  Could not watch ${path.relative(projectRoot, dir)}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Handle graceful shutdown
    const cleanup = () => {
        console.log("\n\n👋 Watch mode stopped.");
        for (const watcher of watchers) {
            watcher.close();
        }
        if (debounceTimer)
            clearTimeout(debounceTimer);
        process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    // Keep process alive
    await new Promise(() => {
        // Never resolves — watch runs until interrupted
    });
}
/**
 * Execute a single run and print results (without process.exit)
 */
async function executeRun(options, projectRoot, clearScreen, isRerun) {
    if (clearScreen && isRerun) {
        // Clear screen using ANSI escape
        process.stdout.write("\x1B[2J\x1B[0f");
    }
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${isRerun ? "🔄 Re-running" : "▶️  Running"} evaluations... (${timestamp})`);
    try {
        const result = await (0, run_1.runEvaluations)({
            specIds: options.specIds,
            impactedOnly: options.impactedOnly,
            baseBranch: options.baseBranch,
            format: options.format,
            writeResults: options.writeResults,
        }, projectRoot);
        if (options.format === "json") {
            (0, run_1.printJsonResults)(result);
        }
        else {
            (0, run_1.printHumanResults)(result);
        }
        // Print watch-specific summary
        const statusIcon = result.summary.failed > 0 ? "❌" : "✅";
        console.log(`\n${statusIcon} ${result.summary.passed}/${result.results.length} passed | Waiting for changes...`);
        return result;
    }
    catch (error) {
        console.error("❌ Run failed:", error instanceof Error ? error.message : String(error));
        console.log("\n⏳ Waiting for changes...");
        return null;
    }
}
