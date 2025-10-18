"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSuite = void 0;
exports.createTestSuite = createTestSuite;
exports.containsKeywords = containsKeywords;
exports.matchesPattern = matchesPattern;
exports.hasSentiment = hasSentiment;
exports.hasLength = hasLength;
const assertions_1 = require("./assertions");
/**
 * Test Suite for declarative evaluation testing
 */
class TestSuite {
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    /**
     * Run all test cases
     *
     * @example
     * ```typescript
     * const results = await suite.run();
     * console.log(`${results.passed}/${results.total} tests passed`);
     * ```
     */
    async run() {
        const startTime = Date.now();
        const results = [];
        const runTestCase = async (testCase, index) => {
            const caseStartTime = Date.now();
            const id = testCase.id || `case-${index}`;
            try {
                // Execute to get output
                let actual;
                if (this.config.executor) {
                    const timeout = this.config.timeout || 30000;
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout));
                    actual = await Promise.race([
                        this.config.executor(testCase.input),
                        timeoutPromise
                    ]);
                }
                else if (testCase.expected) {
                    actual = testCase.expected; // Use expected as actual if no executor
                }
                else {
                    throw new Error('No executor provided and no expected output');
                }
                // Run assertions
                const assertions = [];
                let allPassed = true;
                // Run custom assertions
                if (testCase.assertions) {
                    for (const assertion of testCase.assertions) {
                        const result = assertion(actual);
                        assertions.push(result);
                        if (!result.passed)
                            allPassed = false;
                    }
                }
                // Default equality check if expected provided
                if (testCase.expected && !testCase.assertions) {
                    const result = (0, assertions_1.expect)(actual).toEqual(testCase.expected);
                    assertions.push(result);
                    if (!result.passed)
                        allPassed = false;
                }
                const durationMs = Date.now() - caseStartTime;
                return {
                    id,
                    input: testCase.input,
                    expected: testCase.expected,
                    actual,
                    passed: allPassed,
                    assertions,
                    durationMs
                };
            }
            catch (error) {
                const durationMs = Date.now() - caseStartTime;
                return {
                    id,
                    input: testCase.input,
                    expected: testCase.expected,
                    actual: '',
                    passed: false,
                    assertions: [],
                    durationMs,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        };
        // Run tests
        if (this.config.parallel) {
            results.push(...await Promise.all(this.config.cases.map((tc, i) => runTestCase(tc, i))));
        }
        else {
            for (let i = 0; i < this.config.cases.length; i++) {
                const result = await runTestCase(this.config.cases[i], i);
                results.push(result);
                if (this.config.stopOnFailure && !result.passed) {
                    break;
                }
            }
        }
        const durationMs = Date.now() - startTime;
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        return {
            name: this.name,
            total: results.length,
            passed,
            failed,
            durationMs,
            results
        };
    }
    /**
     * Add a test case to the suite
     */
    addCase(testCase) {
        this.config.cases.push(testCase);
    }
    /**
     * Get suite configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.TestSuite = TestSuite;
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
function createTestSuite(name, config) {
    return new TestSuite(name, config);
}
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
function containsKeywords(keywords) {
    return (output) => (0, assertions_1.expect)(output).toContainKeywords(keywords);
}
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
function matchesPattern(pattern) {
    return (output) => (0, assertions_1.expect)(output).toMatchPattern(pattern);
}
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
function hasSentiment(sentiment) {
    return (output) => (0, assertions_1.expect)(output).toHaveSentiment(sentiment);
}
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
function hasLength(range) {
    return (output) => (0, assertions_1.expect)(output).toHaveLength(range);
}
