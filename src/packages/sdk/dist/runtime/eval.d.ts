/**
 * EvalGate defineEval() DSL - Layer 1 Foundation
 *
 * The core DSL function for defining behavioral specifications.
 * Uses content-addressable identity with AST position for stability.
 */
import { createEvalRuntime, disposeActiveRuntime, getActiveRuntime, setActiveRuntime, withRuntime } from "./registry";
import type { DefineEvalFunction, EvalContext, EvalResult, EvalSpec } from "./types";
/**
 * Export the defineEval function with proper typing
 * This is the main DSL entry point
 */
export declare const defineEval: DefineEvalFunction;
/**
 * Filter a list of specs according to skip/only semantics:
 * - If any spec has mode === "only", return only those specs
 * - Otherwise, return all specs except those with mode === "skip"
 */
export declare function getFilteredSpecs(specs: EvalSpec[]): EvalSpec[];
/**
 * Convenience export for evalai.test() alias (backward compatibility)
 * Provides alternative naming that matches the original roadmap vision
 */
export declare const evalai: {
    test: DefineEvalFunction;
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
export declare function defineSuite(nameOrConfig: string | {
    name: string;
    specs: (() => void)[];
}, specsArg?: (() => void)[]): void;
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
    output?: string;
    durationMs?: number;
    tokens?: number;
}): EvalResult;
export { createEvalRuntime, disposeActiveRuntime, getActiveRuntime, setActiveRuntime, withRuntime, };
export { createContext as createEvalContext };
export { createLocalExecutor } from "./executor";
export default defineEval;
