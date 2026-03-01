"use strict";
/**
 * COMPAT-204: Dual-path execution toggle
 *
 * Environment flag EVALGATE_RUNTIME=legacy|spec|auto
 * Auto uses spec runtime if manifest/specs exist, else legacy
 * Existing projects continue unchanged; new projects can use DSL only
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
exports.ENV_VARS = void 0;
exports.getExecutionMode = getExecutionMode;
exports.canRunSpecMode = canRunSpecMode;
exports.canRunLegacyMode = canRunLegacyMode;
exports.getRecommendedExecutionMode = getRecommendedExecutionMode;
exports.validateExecutionMode = validateExecutionMode;
exports.printExecutionModeInfo = printExecutionModeInfo;
exports.hasExecutionModeEnv = hasExecutionModeEnv;
exports.getExecutionModeEnv = getExecutionModeEnv;
exports.setExecutionModeEnv = setExecutionModeEnv;
exports.clearExecutionModeEnv = clearExecutionModeEnv;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/**
 * Get execution mode from environment or auto-detection
 */
async function getExecutionMode(projectRoot = process.cwd()) {
    // Check environment variable first
    const envMode = process.env.EVALGATE_RUNTIME?.toLowerCase();
    if (envMode === "legacy" || envMode === "spec" || envMode === "auto") {
        return {
            mode: envMode,
            hasSpecRuntime: envMode !== "legacy",
            hasLegacyRuntime: envMode !== "spec",
            projectRoot,
            specFiles: envMode !== "legacy" ? await findSpecFiles(projectRoot) : [],
            legacyConfig: envMode !== "spec" ? await findLegacyConfig(projectRoot) : undefined,
        };
    }
    // Auto-detect mode
    return await autoDetectExecutionMode(projectRoot);
}
/**
 * Auto-detect execution mode based on project structure
 */
async function autoDetectExecutionMode(projectRoot) {
    const specFiles = await findSpecFiles(projectRoot);
    const legacyConfig = await findLegacyConfig(projectRoot);
    const hasSpecRuntime = specFiles.length > 0;
    const hasLegacyRuntime = !!legacyConfig;
    let mode = "auto";
    // If both are available, prefer spec runtime for new projects
    if (hasSpecRuntime && hasLegacyRuntime) {
        mode = "spec"; // Prefer spec for mixed projects
    }
    else if (hasSpecRuntime) {
        mode = "spec";
    }
    else if (hasLegacyRuntime) {
        mode = "legacy";
    }
    else {
        mode = "auto"; // Default to auto for empty projects
    }
    return {
        mode,
        hasSpecRuntime,
        hasLegacyRuntime,
        projectRoot,
        specFiles,
        legacyConfig,
    };
}
/**
 * Find spec files in project
 */
async function findSpecFiles(projectRoot) {
    const specPatterns = [
        "eval/**/*.spec.ts",
        "eval/**/*.spec.js",
        "src/**/*.spec.ts",
        "src/**/*.spec.js",
        "tests/**/*.spec.ts",
        "tests/**/*.spec.js",
        "spec/**/*.ts",
        "spec/**/*.js",
    ];
    const foundFiles = [];
    for (const pattern of specPatterns) {
        try {
            const files = await searchFiles(projectRoot, pattern, projectRoot);
            foundFiles.push(...files);
        }
        catch (_error) {
            // Ignore errors for non-existent paths
        }
    }
    // Filter for files that contain defineEval calls
    const specFilesWithDefineEval = [];
    for (const file of foundFiles) {
        try {
            const content = await fs.readFile(file, "utf-8");
            if (content.includes("defineEval")) {
                specFilesWithDefineEval.push(file);
            }
        }
        catch (_error) {
            // Ignore read errors
        }
    }
    return specFilesWithDefineEval;
}
/**
 * Simple file search (placeholder for proper glob implementation)
 */
async function searchFiles(dir, pattern, projectRoot) {
    const results = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith(".")) {
                results.push(...(await searchFiles(fullPath, pattern, projectRoot)));
            }
            else if (entry.isFile()) {
                // Simple pattern matching
                if (matchesPattern(fullPath, pattern, projectRoot)) {
                    results.push(fullPath);
                }
            }
        }
    }
    catch (_error) {
        // Ignore permission errors
    }
    return results;
}
/**
 * Simple pattern matching (placeholder for proper glob)
 */
function matchesPattern(filePath, pattern, projectRoot) {
    const _fileName = path.basename(filePath);
    const _ext = path.extname(filePath);
    const _dir = path.dirname(filePath);
    // Convert glob pattern to regex
    // Handle **/ and * patterns correctly
    let regexPattern = pattern;
    // Replace **/ with (?:.*/)? to match optional directory path
    regexPattern = regexPattern.replace(/\*\*\//g, "(?:.*/)?");
    // Replace remaining * with [^/]* (filename pattern)
    regexPattern = regexPattern.replace(/\*/g, "[^/]*");
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(relativePath);
}
/**
 * Find legacy config file
 */
async function findLegacyConfig(projectRoot) {
    const configPaths = [
        "evalai.config.json",
        "evalai.config.js",
        "evalai.config.ts",
        ".evalgaterc",
        ".evalgaterc.json",
    ];
    for (const configPath of configPaths) {
        const fullPath = path.join(projectRoot, configPath);
        try {
            await fs.access(fullPath);
            return fullPath;
        }
        catch (_error) {
            // File doesn't exist, continue
        }
    }
    return undefined;
}
/**
 * Check if project can run in spec mode
 */
function canRunSpecMode(config) {
    return config.hasSpecRuntime && config.specFiles.length > 0;
}
/**
 * Check if project can run in legacy mode
 */
function canRunLegacyMode(config) {
    return config.hasLegacyRuntime && !!config.legacyConfig;
}
/**
 * Get recommended execution mode for project
 */
function getRecommendedExecutionMode(config) {
    if (config.mode !== "auto") {
        return config.mode;
    }
    if (canRunSpecMode(config) && canRunLegacyMode(config)) {
        return "spec"; // Prefer spec for mixed projects
    }
    if (canRunSpecMode(config)) {
        return "spec";
    }
    if (canRunLegacyMode(config)) {
        return "legacy";
    }
    return "auto";
}
/**
 * Validate execution mode compatibility
 */
function validateExecutionMode(config) {
    const warnings = [];
    const errors = [];
    // Check for mixed project
    if (config.hasSpecRuntime && config.hasLegacyRuntime) {
        warnings.push("Project contains both spec files and legacy config. " +
            "Consider migrating legacy tests to spec format for consistency.");
    }
    // Check for no runtime
    if (!config.hasSpecRuntime && !config.hasLegacyRuntime) {
        warnings.push("No tests found. This appears to be an empty project. " +
            "Use 'evalgate init' to create a new project.");
    }
    // Check for spec mode without spec files
    if (config.mode === "spec" && !canRunSpecMode(config)) {
        errors.push("Spec mode requested but no spec files found. " +
            "Create spec files with defineEval() or use legacy mode.");
    }
    // Check for legacy mode without config
    if (config.mode === "legacy" && !canRunLegacyMode(config)) {
        errors.push("Legacy mode requested but no evalgate.config.json (or evalai.config.json) found. " +
            "Create a config file or use spec mode.");
    }
    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}
/**
 * Print execution mode information
 */
function printExecutionModeInfo(config) {
    console.log(`🔧 EvalGate Execution Mode: ${config.mode.toUpperCase()}`);
    console.log(`📁 Project root: ${config.projectRoot}`);
    console.log(``);
    if (config.hasSpecRuntime) {
        console.log(`✅ Spec runtime available`);
        console.log(`   Found ${config.specFiles.length} spec file(s):`);
        config.specFiles.slice(0, 5).forEach((file) => {
            console.log(`   - ${path.relative(config.projectRoot, file)}`);
        });
        if (config.specFiles.length > 5) {
            console.log(`   ... and ${config.specFiles.length - 5} more`);
        }
    }
    else {
        console.log(`❌ No spec runtime found`);
    }
    console.log(``);
    if (config.hasLegacyRuntime) {
        console.log(`✅ Legacy runtime available`);
        if (config.legacyConfig) {
            console.log(`   Config: ${path.relative(config.projectRoot, config.legacyConfig)}`);
        }
    }
    else {
        console.log(`❌ No legacy runtime found`);
    }
    console.log(``);
    const validation = validateExecutionMode(config);
    if (validation.warnings.length > 0) {
        console.log(`⚠️  Warnings:`);
        validation.warnings.forEach((warning) => {
            console.log(`   ${warning}`);
        });
        console.log(``);
    }
    if (validation.errors.length > 0) {
        console.log(`❌ Errors:`);
        validation.errors.forEach((error) => {
            console.log(`   ${error}`);
        });
        console.log(``);
    }
    const recommended = getRecommendedExecutionMode(config);
    console.log(`💡 Recommended mode: ${recommended.toUpperCase()}`);
    if (config.mode === "auto") {
        console.log(`🔄 Auto mode will use: ${recommended.toUpperCase()}`);
    }
}
/**
 * Environment variable helpers
 */
exports.ENV_VARS = {
    EXECUTION_MODE: "EVALGATE_RUNTIME",
    POSSIBLE_VALUES: ["legacy", "spec", "auto"],
    DEFAULT: "auto",
};
/**
 * Check if environment variable is set
 */
function hasExecutionModeEnv() {
    return !!process.env.EVALGATE_RUNTIME;
}
/**
 * Get current environment variable value
 */
function getExecutionModeEnv() {
    return process.env.EVALGATE_RUNTIME;
}
/**
 * Set execution mode environment variable
 */
function setExecutionModeEnv(mode) {
    process.env.EVALGATE_RUNTIME = mode;
}
/**
 * Clear execution mode environment variable
 */
function clearExecutionModeEnv() {
    delete process.env.EVALGATE_RUNTIME;
}
