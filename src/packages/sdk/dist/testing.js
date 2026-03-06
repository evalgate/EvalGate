"use strict";
/**
 * Test Suite Builder
 * Tier 2.7: Declarative test definitions
 *
 * @example
 * ```typescript
 * import { createTestSuite, expect } from '@evalgate/sdk';
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
        // Deterministic shuffle when seed is provided
        const orderedCases = this.config.cases.map((c, i) => ({
            case: c,
            originalIndex: i,
        }));
        if (this.config.seed !== undefined) {
            // mulberry32 seeded PRNG
            let s = this.config.seed | 0;
            const rand = () => {
                s = (s + 0x6d2b79f5) | 0;
                let t = Math.imul(s ^ (s >>> 15), 1 | s);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
            // Fisher-Yates shuffle
            for (let i = orderedCases.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [orderedCases[i], orderedCases[j]] = [orderedCases[j], orderedCases[i]];
            }
        }
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
                        timeoutPromise,
                    ]);
                }
                else if (testCase.expected) {
                    actual = testCase.expected; // Use expected as actual if no executor
                }
                else {
                    throw new Error("No executor provided and no expected output");
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
                    durationMs,
                };
            }
            catch (error) {
                const durationMs = Date.now() - caseStartTime;
                return {
                    id,
                    input: testCase.input,
                    expected: testCase.expected,
                    actual: "",
                    passed: false,
                    assertions: [],
                    durationMs,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        };
        // Run tests (using orderedCases which may be seeded-shuffled)
        if (this.config.parallel) {
            results.push(...(await Promise.all(orderedCases.map((oc) => runTestCase(oc.case, oc.originalIndex)))));
        }
        else {
            for (const oc of orderedCases) {
                const result = await runTestCase(oc.case, oc.originalIndex);
                results.push(result);
                if ((this.config.stopOnFailure || this.config.strict) &&
                    !result.passed) {
                    break;
                }
            }
        }
        const retriedCases = [];
        const retries = this.config.retries ?? 0;
        const baseDelay = this.config.retryDelayMs ?? 500;
        const jitterFraction = this.config.retryJitter ?? 0.5;
        if (retries > 0 && results.length > 0) {
            const failingIndices = results
                .map((r, i) => (r.passed ? -1 : i))
                .filter((i) => i >= 0);
            for (let attempt = 0; attempt < retries && failingIndices.length > 0; attempt++) {
                // Exponential backoff with jitter before each retry round
                const delay = baseDelay * 2 ** attempt;
                const jitter = jitterFraction > 0
                    ? delay * jitterFraction * (Math.random() * 2 - 1)
                    : 0;
                const waitMs = Math.max(0, Math.round(delay + jitter));
                if (waitMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                }
                const toRetry = [...failingIndices];
                failingIndices.length = 0;
                for (const idx of toRetry) {
                    const tc = results[idx]; // retry based on result index
                    const originalCase = orderedCases.find((oc) => (oc.case.id || `case-${oc.originalIndex}`) === tc.id);
                    if (!originalCase)
                        continue;
                    const retryResult = await runTestCase(originalCase.case, originalCase.originalIndex);
                    if (retryResult.passed) {
                        results[idx] = retryResult;
                        retriedCases.push(retryResult.id);
                    }
                    else {
                        failingIndices.push(idx);
                    }
                }
            }
        }
        const durationMs = Date.now() - startTime;
        const passed = results.filter((r) => r.passed).length;
        const failed = results.filter((r) => !r.passed).length;
        return {
            name: this.name,
            total: results.length,
            passed,
            failed,
            durationMs,
            results,
            ...(retriedCases.length > 0 && { retriedCases }),
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
    /**
     * Get test definitions for introspection
     * COMPAT-201: Public TestSuite introspection (minimal getters)
     */
    getTests() {
        return this.config.cases.map((testCase, index) => ({
            id: testCase.id || `case-${index}`,
            input: testCase.input,
            expected: testCase.expected,
            metadata: testCase.metadata,
            hasAssertions: !!testCase.assertions && testCase.assertions.length > 0,
            assertionCount: testCase.assertions?.length || 0,
        }));
    }
    /**
     * Get suite metadata for introspection
     * COMPAT-201: Public TestSuite introspection (minimal getters)
     */
    getMetadata() {
        return {
            suiteName: this.name,
            tags: [], // TestSuite doesn't have tags, but include for future compatibility
            defaults: {
                timeout: this.config.timeout,
                parallel: this.config.parallel,
                stopOnFailure: this.config.stopOnFailure,
                retries: this.config.retries,
            },
        };
    }
    /**
     * Convert to portable suite representation
     * COMPAT-201: Public TestSuite introspection (minimal getters)
     */
    toJSON() {
        return {
            name: this.name,
            config: this.getConfig(),
            tests: this.getTests(),
            metadata: this.getMetadata(),
        };
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
