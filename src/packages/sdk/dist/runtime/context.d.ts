/**
 * EvalAI Runtime Context - Layer 1 Foundation
 *
 * Execution context management for specifications.
 * Provides clean isolation and proper resource management.
 */
import type { EvalContext, EvalOptions } from "./types";
/**
 * Create a new execution context
 */
export declare function createContext<TInput = string>(input: TInput, metadata?: Record<string, unknown>, options?: EvalOptions): EvalContext & {
    input: TInput;
};
/**
 * Merge contexts with proper precedence
 * Later contexts override earlier ones
 */
export declare function mergeContexts(base: EvalContext, ...overrides: Partial<EvalContext>[]): EvalContext;
/**
 * Clone a context for safe modification
 */
export declare function cloneContext(context: EvalContext): EvalContext;
/**
 * Validate context structure
 */
export declare function validateContext(context: EvalContext): void;
