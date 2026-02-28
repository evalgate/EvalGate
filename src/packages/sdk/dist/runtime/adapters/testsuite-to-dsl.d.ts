/**
 * COMPAT-202: Legacy TestSuite → defineEval adapter
 *
 * Converts legacy TestSuite instances to defineEval specifications
 * without forcing migration. Enables lossless where possible.
 */
import type { TestSuite } from "../../testing";
import type { EvalSpec } from "../types";
/**
 * Adapter configuration options
 */
export interface TestSuiteAdapterOptions {
    /** Include provenance metadata in generated specs */
    includeProvenance?: boolean;
    /** Preserve original test IDs */
    preserveIds?: boolean;
    /** Generate helper functions for assertions */
    generateHelpers?: boolean;
}
/**
 * Convert TestSuite to defineEval specifications
 *
 * @param suite - Legacy TestSuite instance
 * @param options - Adapter configuration options
 * @returns Array of EvalSpec definitions
 */
export declare function adaptTestSuite(suite: TestSuite, options?: Partial<TestSuiteOptions>): EvalSpec[];
/**
 * Generate defineEval code from TestSuite
 *
 * @param suite - Legacy TestSuite instance
 * @param options - Code generation options
 * @returns Generated TypeScript code
 */
export declare function generateDefineEvalCode(suite: TestSuite, options?: Partial<TestSuiteOptions>): string;
/**
 * Create adapter configuration for TestSuite
 */
export interface TestSuiteConfig {
    /** Test cases to run */
    cases: any[];
    /** Function that generates output from input */
    executor?: (input: string) => Promise<string>;
    /** Run tests in parallel (default: true) */
    parallel?: boolean;
    /** Stop on first failure (default: false) */
    stopOnFailure?: boolean;
    /** Timeout per test case in ms (default: 30000) */
    timeout?: number;
    /** Retry failing cases N times (default: 0) */
    retries?: number;
}
/**
 * TestSuite options (alias for compatibility)
 */
export interface TestSuiteOptions extends TestSuiteConfig {
    /** Include provenance metadata in generated specs */
    includeProvenance?: boolean;
    /** Preserve original test IDs */
    preserveIds?: boolean;
    /** Generate helper functions for assertions */
    generateHelpers?: boolean;
}
