/**
 * Test Suite Builder
 * Tier 2.7: Declarative test definitions
 *
 * @example
 * ```typescript
 * import { createTestSuite, expect } from '@ai-eval-platform/sdk';
 *
 * const suite = createTestSuite('chatbot-responses', {
 *   cases: [
 *     {
 *       input: 'Hello',
 *       assertions: [
 *         (output) => expect(output).toContain('greeting'),
 *         (output) => expect(output).toHaveSentiment('positive')
 *       ]
 *     }
 *   ]
 * });
 *
 * const results = await suite.run();
 * ```
 */
import { AssertionResult } from './assertions';
export interface TestCase {
    /** Unique identifier for the test case */
    id?: string;
    /** Input to the LLM */
    input: string;
    /** Expected output (optional) */
    expected?: string;
    /** Metadata for the test case */
    metadata?: Record<string, any>;
    /** Assertion functions to run */
    assertions?: ((output: string) => AssertionResult)[];
}
export interface TestSuiteConfig {
    /** Test cases to run */
    cases: TestCase[];
    /** Function that generates output from input */
    executor?: (input: string) => Promise<string>;
    /** Run tests in parallel (default: true) */
    parallel?: boolean;
    /** Stop on first failure (default: false) */
    stopOnFailure?: boolean;
    /** Timeout per test case in ms (default: 30000) */
    timeout?: number;
}
export interface TestCaseResult {
    /** Test case ID */
    id: string;
    /** Input that was tested */
    input: string;
    /** Expected output */
    expected?: string;
    /** Actual output */
    actual: string;
    /** Whether test passed */
    passed: boolean;
    /** Assertion results */
    assertions: AssertionResult[];
    /** Duration in milliseconds */
    durationMs: number;
    /** Error if test failed to execute */
    error?: string;
}
export interface TestSuiteResult {
    /** Suite name */
    name: string;
    /** Total number of test cases */
    total: number;
    /** Number of passed tests */
    passed: number;
    /** Number of failed tests */
    failed: number;
    /** Total duration in milliseconds */
    durationMs: number;
    /** Individual test results */
    results: TestCaseResult[];
}
/**
 * Test Suite for declarative evaluation testing
 */
export declare class TestSuite {
    private name;
    private config;
    constructor(name: string, config: TestSuiteConfig);
    /**
     * Run all test cases
     *
     * @example
     * ```typescript
     * const results = await suite.run();
     * console.log(`${results.passed}/${results.total} tests passed`);
     * ```
     */
    run(): Promise<TestSuiteResult>;
    /**
     * Add a test case to the suite
     */
    addCase(testCase: TestCase): void;
    /**
     * Get suite configuration
     */
    getConfig(): TestSuiteConfig;
}
/**
 * Create a test suite
 *
 * @example
 * ```typescript
 * const suite = createTestSuite('my-tests', {
 *   cases: [
 *     {
 *       input: 'Hello',
 *       assertions: [
 *         (output) => expect(output).toContain('hi'),
 *         (output) => expect(output).toHaveSentiment('positive')
 *       ]
 *     }
 *   ],
 *   executor: async (input) => {
 *     // Your LLM call here
 *     return callLLM(input);
 *   }
 * });
 * ```
 */
export declare function createTestSuite(name: string, config: TestSuiteConfig): TestSuite;
/**
 * Helper to create assertions from expected keywords
 *
 * @example
 * ```typescript
 * const suite = createTestSuite('tests', {
 *   cases: [
 *     {
 *       input: 'refund policy',
 *       assertions: containsKeywords(['refund', 'return', 'policy'])
 *     }
 *   ]
 * });
 * ```
 */
export declare function containsKeywords(keywords: string[]): (output: string) => AssertionResult;
/**
 * Helper to create pattern matching assertion
 *
 * @example
 * ```typescript
 * const suite = createTestSuite('tests', {
 *   cases: [
 *     {
 *       input: 'What time is it?',
 *       assertions: matchesPattern(/\d{1,2}:\d{2}/)
 *     }
 *   ]
 * });
 * ```
 */
export declare function matchesPattern(pattern: RegExp): (output: string) => AssertionResult;
/**
 * Helper to create sentiment assertion
 *
 * @example
 * ```typescript
 * const suite = createTestSuite('tests', {
 *   cases: [
 *     {
 *       input: 'Thank you!',
 *       assertions: hasSentiment('positive')
 *     }
 *   ]
 * });
 * ```
 */
export declare function hasSentiment(sentiment: 'positive' | 'negative' | 'neutral'): (output: string) => AssertionResult;
/**
 * Helper to create length range assertion
 *
 * @example
 * ```typescript
 * const suite = createTestSuite('tests', {
 *   cases: [
 *     {
 *       input: 'Summarize this',
 *       assertions: hasLength({ min: 50, max: 200 })
 *     }
 *   ]
 * });
 * ```
 */
export declare function hasLength(range: {
    min?: number;
    max?: number;
}): (output: string) => AssertionResult;
