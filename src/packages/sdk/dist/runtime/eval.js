"use strict";
/**
 * EvalAI defineEval() DSL - Layer 1 Foundation
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
exports.evalai = exports.defineEval = void 0;
exports.defineSuite = defineSuite;
exports.createContext = createContext;
exports.createResult = createResult;
const crypto = __importStar(require("node:crypto"));
const path = __importStar(require("node:path"));
const registry_1 = require("./registry");
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
function defineEvalImpl(nameOrConfig, executor, options) {
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
    };
    // Register specification
    runtime.register(spec);
}
/**
 * Export the defineEval function with proper typing
 * This is the main DSL entry point
 */
exports.defineEval = defineEvalImpl;
/**
 * Convenience export for evalai.test() alias
 * Provides alternative naming that matches the original roadmap vision
 */
exports.evalai = {
    test: exports.defineEval,
};
/**
 * Suite definition for grouping related specifications
 * This will be expanded in Layer 3 for dependency graph support
 */
function defineSuite(_name, specs) {
    // For now, just execute the specs to register them
    // In Layer 3, this will build the dependency graph
    for (const specFn of specs) {
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
    };
}
/**
 * Default export for convenience
 */
exports.default = exports.defineEval;
