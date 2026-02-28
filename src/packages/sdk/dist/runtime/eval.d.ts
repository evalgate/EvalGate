/**
 * EvalAI defineEval() DSL - Layer 1 Foundation
 *
 * The core DSL function for defining behavioral specifications.
 * Uses content-addressable identity with AST position for stability.
 */
import type { DefineEvalFunction, EvalContext, EvalResult } from "./types";
/**
 * Export the defineEval function with proper typing
 * This is the main DSL entry point
 */
export declare const defineEval: DefineEvalFunction;
/**
 * Convenience export for evalai.test() alias
 * Provides alternative naming that matches the original roadmap vision
 */
export declare const evalai: {
    test: DefineEvalFunction;
};
/**
 * Suite definition for grouping related specifications
 * This will be expanded in Layer 3 for dependency graph support
 */
export declare function defineSuite(_name: string, specs: (() => void)[]): void;
/**
 * Helper function to create specification contexts
 * Useful for testing and manual execution
 */
export declare function createContext<TInput = string>(input: TInput, metadata?: Record<string, unknown>, options?: EvalContext["options"]): EvalContext & {
    input: TInput;
};
/**
 * Helper function to create specification results
 * Provides a convenient builder pattern for common result patterns
 */
export declare function createResult(config: {
    pass: boolean;
    score: number;
    assertions?: EvalResult["assertions"];
    metadata?: Record<string, unknown>;
    error?: string;
}): EvalResult;
/**
 * Default export for convenience
 */
export default defineEval;
