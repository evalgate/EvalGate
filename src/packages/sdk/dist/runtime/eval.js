"use strict";
/**
 * EvalGate defineEval() DSL - Layer 1 Foundation
 *
 * The core DSL function for defining behavioral specifications.
 * Uses content-addressable identity with AST position for stability.
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
exports.createLocalExecutor = exports.withRuntime = exports.setActiveRuntime = exports.getActiveRuntime = exports.disposeActiveRuntime = exports.createEvalRuntime = exports.evalai = exports.defineEval = void 0;
exports.getFilteredSpecs = getFilteredSpecs;
exports.defineSuite = defineSuite;
exports.createContext = createContext;
exports.createEvalContext = createContext;
exports.createResult = createResult;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const registry_1 = require("./registry");
Object.defineProperty(exports, "createEvalRuntime", { enumerable: true, get: function () { return registry_1.createEvalRuntime; } });
Object.defineProperty(exports, "disposeActiveRuntime", { enumerable: true, get: function () { return registry_1.disposeActiveRuntime; } });
Object.defineProperty(exports, "getActiveRuntime", { enumerable: true, get: function () { return registry_1.getActiveRuntime; } });
Object.defineProperty(exports, "setActiveRuntime", { enumerable: true, get: function () { return registry_1.setActiveRuntime; } });
Object.defineProperty(exports, "withRuntime", { enumerable: true, get: function () { return registry_1.withRuntime; } });
const types_1 = require("./types");
/**
 * Extract AST position from call stack
 * This provides stable identity that survives renames but changes when logic moves
 */
function getCallerPosition() {
    const stack = new Error().stack;
    if (!stack) {
        throw new types_1.SpecRegistrationError("Unable to determine caller position");
    }
    // Parse stack trace to find the caller
    const lines = stack.split("\n");
    // Skip current function and find the actual caller
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line ||
            line.includes("node_modules") ||
            line.includes("internal/modules")) {
            continue;
        }
        // Extract file path, line, and column
        const match = line.match(/at\s+.*?\((.*?):(\d+):(\d+)\)/);
        if (match) {
            const [, filePath, lineNum, colNum] = match;
            return {
                filePath: path.resolve(filePath),
                line: parseInt(lineNum, 10),
                column: parseInt(colNum, 10),
            };
        }
        // Alternative format for some environments
        const altMatch = line.match(/at\s+(.*?):(\d+):(\d+)/);
        if (altMatch) {
            const [, filePath, lineNum, colNum] = altMatch;
            return {
                filePath: path.resolve(filePath),
                line: parseInt(lineNum, 10),
                column: parseInt(colNum, 10),
            };
        }
    }
    throw new types_1.SpecRegistrationError("Unable to parse caller position from stack trace");
}
/**
 * Generate content-addressable specification ID
 */
function generateSpecId(namespace, filePath, name, position) {
    // Canonicalize path: relative to project root with POSIX separators
    const projectRoot = process.cwd();
    const relativePath = path.relative(projectRoot, filePath);
    const canonicalPath = relativePath.split(path.sep).join("/"); // Force POSIX separators
    const components = [
        namespace,
        canonicalPath,
        name,
        `${position.line}:${position.column}`,
    ];
    const content = components.join("|");
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 20);
}
/**
 * Validate specification name
 */
function validateSpecName(name) {
    if (!name || typeof name !== "string") {
        throw new types_1.SpecRegistrationError("Specification name must be a non-empty string");
    }
    if (name.trim() === "") {
        throw new types_1.SpecRegistrationError("Specification name cannot be empty");
    }
    if (name.length > 100) {
        throw new types_1.SpecRegistrationError("Specification name must be 100 characters or less");
    }
    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        throw new types_1.SpecRegistrationError("Specification name can only contain letters, numbers, spaces, hyphens, and underscores");
    }
}
/**
 * Validate executor function
 */
function validateExecutor(executor) {
    if (typeof executor !== "function") {
        throw new types_1.SpecRegistrationError("Executor must be a function");
    }
    // Check function length (should accept context parameter)
    if (executor.length > 1) {
        throw new types_1.SpecRegistrationError("Executor should accept exactly one parameter (context)");
    }
}
/**
 * Create specification configuration from parameters
 */
function createSpecConfig(nameOrConfig, executor, options) {
    if (typeof nameOrConfig === "string") {
        // defineEval(name, executor, options) form
        if (!executor) {
            throw new types_1.SpecRegistrationError("Executor function is required when using name parameter");
        }
        return {
            name: nameOrConfig,
            executor,
            ...options,
        };
    }
    else {
        // defineEval(config) form
        return nameOrConfig;
    }
}
/**
 * Core defineEval function implementation
 */
function defineEvalWithMode(mode, nameOrConfig, executor, options) {
    // Get caller position for identity
    const callerPosition = getCallerPosition();
    // Create specification configuration
    const config = createSpecConfig(nameOrConfig, executor, options);
    // Validate configuration
    validateSpecName(config.name);
    validateExecutor(config.executor);
    // Get active runtime
    const runtime = (0, registry_1.getActiveRuntime)();
    // Generate specification ID
    const specId = generateSpecId(runtime.namespace, callerPosition.filePath, config.name, callerPosition);
    // Create specification
    const spec = {
        id: specId,
        name: config.name,
        filePath: callerPosition.filePath,
        position: callerPosition,
        description: config.description,
        tags: config.tags,
        executor: config.executor,
        metadata: config.metadata,
        config: {
            timeout: config.timeout,
            retries: config.retries,
            budget: config.budget,
            model: config.model,
        },
        mode,
    };
    // Register specification
    runtime.register(spec);
}
function defineEvalImpl(nameOrConfig, executor, options) {
    defineEvalWithMode("normal", nameOrConfig, executor, options);
}
function defineEvalSkipImpl(nameOrConfig, executor, options) {
    defineEvalWithMode("skip", nameOrConfig, executor, options);
}
function defineEvalOnlyImpl(nameOrConfig, executor, options) {
    defineEvalWithMode("only", nameOrConfig, executor, options);
}
/**
 * Export the defineEval function with proper typing
 * This is the main DSL entry point
 */
exports.defineEval = defineEvalImpl;
// Attach .skip and .only modifiers (vitest/jest convention)
exports.defineEval.skip = defineEvalSkipImpl;
exports.defineEval.only = defineEvalOnlyImpl;
/**
 * Parse a JSONL file into an array of row objects.
 * Each line must be a valid JSON object; blank lines are skipped.
 */
function parseJsonl(content) {
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line, i) => {
        try {
            return JSON.parse(line);
        }
        catch {
            throw new types_1.SpecRegistrationError(`Invalid JSON on line ${i + 1} of dataset`);
        }
    });
}
/**
 * Parse a simple CSV file into an array of row objects.
 * First line is treated as headers. Values are unquoted strings.
 * For complex CSV (quoted fields, escapes), use a dedicated library.
 */
function parseCsv(content) {
    const lines = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length < 2)
        return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row = {};
        for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = values[i] ?? "";
        }
        return row;
    });
}
/**
 * Load a JSONL or CSV dataset and register one spec per row.
 */
function fromDatasetImpl(name, datasetPath, executor, options) {
    const resolvedPath = path.isAbsolute(datasetPath)
        ? datasetPath
        : path.resolve(process.cwd(), datasetPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new types_1.SpecRegistrationError(`Dataset file not found: ${resolvedPath}`);
    }
    const content = fs.readFileSync(resolvedPath, "utf8");
    const ext = path.extname(resolvedPath).toLowerCase();
    let rows;
    if (ext === ".jsonl" || ext === ".ndjson") {
        rows = parseJsonl(content);
    }
    else if (ext === ".csv") {
        rows = parseCsv(content);
    }
    else if (ext === ".json") {
        const parsed = JSON.parse(content);
        rows = Array.isArray(parsed) ? parsed : [parsed];
    }
    else {
        throw new types_1.SpecRegistrationError(`Unsupported dataset format: ${ext}. Use .jsonl, .ndjson, .csv, or .json`);
    }
    if (rows.length === 0) {
        throw new types_1.SpecRegistrationError(`Dataset is empty: ${resolvedPath}`);
    }
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const specName = `${name} - row ${i + 1}`;
        const wrappedExecutor = (context) => executor({ ...context, input: row });
        defineEvalWithMode("normal", specName, wrappedExecutor, {
            ...options,
            metadata: {
                ...options?.metadata,
                datasetPath: resolvedPath,
                datasetRow: i + 1,
            },
        });
    }
}
exports.defineEval.fromDataset = fromDatasetImpl;
/**
 * Filter a list of specs according to skip/only semantics:
 * - If any spec has mode === "only", return only those specs
 * - Otherwise, return all specs except those with mode === "skip"
 */
function getFilteredSpecs(specs) {
    const onlySpecs = specs.filter((s) => s.mode === "only");
    if (onlySpecs.length > 0) {
        return onlySpecs;
    }
    return specs.filter((s) => s.mode !== "skip");
}
/**
 * Convenience export for evalai.test() alias (backward compatibility)
 * Provides alternative naming that matches the original roadmap vision
 */
exports.evalai = {
    test: exports.defineEval,
};
/**
 * Suite definition for grouping related specifications.
 * Accepts both a positional form and an object form:
 *
 * @example Positional form:
 * defineSuite('My Suite', [() => defineEval('spec 1', executor), ...])
 *
 * @example Object form:
 * defineSuite({ name: 'My Suite', specs: [() => defineEval('spec 1', executor), ...] })
 */
function defineSuite(nameOrConfig, specsArg) {
    const specFns = typeof nameOrConfig === "string"
        ? (specsArg ?? [])
        : (nameOrConfig.specs ?? []);
    // Execute each spec function to register its defineEval calls
    // In Layer 3, this will also build the dependency graph
    for (const specFn of specFns) {
        specFn();
    }
}
/**
 * Helper function to create specification contexts
 * Useful for testing and manual execution
 */
function createContext(input, metadata, options) {
    return {
        input: input,
        metadata,
        options,
    };
}
/**
 * Helper function to create specification results
 * Provides a convenient builder pattern for common result patterns
 */
function createResult(config) {
    return {
        pass: config.pass,
        score: Math.max(0, Math.min(100, config.score)), // Clamp to 0-100
        assertions: config.assertions,
        metadata: config.metadata,
        error: config.error,
        output: config.output,
        durationMs: config.durationMs,
        tokens: config.tokens,
    };
}
/**
 * Default export for convenience
 */
// Register defineEval with registry to break circular dependency
(0, registry_1._registerDefineEval)(exports.defineEval);
// Re-export createLocalExecutor from executor.ts
var executor_1 = require("./executor");
Object.defineProperty(exports, "createLocalExecutor", { enumerable: true, get: function () { return executor_1.createLocalExecutor; } });
exports.default = exports.defineEval;
