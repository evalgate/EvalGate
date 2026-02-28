/**
 * EvalAI Local Executor - Layer 1 Foundation
 *
 * Local execution engine that runs specifications without database coupling.
 * Implements the execution interface for the new programming model.
 */
import type { LocalExecutor } from "./types";
/**
 * Create a new local executor
 */
export declare function createLocalExecutor(): LocalExecutor;
/**
 * Default local executor instance
 * For convenience in simple use cases
 */
export declare const defaultLocalExecutor: LocalExecutor;
