"use strict";
/**
 * EvalGate Runtime Context - Layer 1 Foundation
 *
 * Execution context management for specifications.
 * Provides clean isolation and proper resource management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
exports.mergeContexts = mergeContexts;
exports.cloneContext = cloneContext;
exports.validateContext = validateContext;
/**
 * Create a new execution context
 */
function createContext(input, metadata, options) {
    return {
        input: input,
        metadata,
        options,
    };
}
/**
 * Merge contexts with proper precedence
 * Later contexts override earlier ones
 */
function mergeContexts(base, ...overrides) {
    // Ensure base has a valid input
    if (!base.input) {
        throw new Error("Base context must have a valid input");
    }
    const merged = overrides.reduce((merged, override) => ({
        input: override.input ?? merged.input,
        metadata: {
            ...merged.metadata,
            ...override.metadata,
        },
        options: override.options
            ? {
                ...merged.options,
                ...override.options,
            }
            : merged.options,
    }), base);
    // Type assertion since we've ensured input exists
    return merged;
}
/**
 * Clone a context for safe modification
 */
function cloneContext(context) {
    return {
        input: context.input,
        metadata: { ...context.metadata },
        options: context.options ? { ...context.options } : undefined,
    };
}
/**
 * Validate context structure
 */
function validateContext(context) {
    if (!context || typeof context !== "object") {
        throw new Error("Context must be an object");
    }
    if (typeof context.input !== "string") {
        throw new Error("Context input must be a string");
    }
    if (context.metadata && typeof context.metadata !== "object") {
        throw new Error("Context metadata must be an object");
    }
    if (context.options && typeof context.options !== "object") {
        throw new Error("Context options must be an object");
    }
}
