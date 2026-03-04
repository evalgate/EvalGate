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

import { type AssertionResult, expect } from "./assertions";

/**
 * Test suite case definition (different from API TestCase type)
 * Use this for defining test cases in test suites with assertions
 */
export interface TestSuiteCase {
	/** Unique identifier for the test case */
	id?: string;
	/** Input to the LLM */
	input: string;
	/** Expected output (optional) */
	expected?: string;
	/** Metadata for the test case */
	metadata?: Record<string, unknown>;
	/** Assertion functions to run */
	assertions?: ((output: string) => AssertionResult)[];
}

// Legacy export for backward compatibility
/** @deprecated Use TestSuiteCase instead to avoid confusion with API TestCase type */
export type TestCase = TestSuiteCase;

export interface TestSuiteConfig {
	/** Test cases to run */
	cases: TestSuiteCase[];
	/** Function that generates output from input */
	executor?: (input: string) => Promise<string>;
	/** Run tests in parallel (default: true) */
	parallel?: boolean;
	/** Stop on first failure (default: false) */
	stopOnFailure?: boolean;
	/** Timeout per test case in ms (default: 30000) */
	timeout?: number;
	/** Alias for stopOnFailure — fail the entire suite on the first failing case. Useful in pre-commit hooks. */
	strict?: boolean;
	/** Retry failing cases N times (default: 0). Only failing cases are retried. */
	retries?: number;
	/** Base delay between retries in ms (default: 500). Exponential backoff: delay * 2^attempt. */
	retryDelayMs?: number;
	/** Add random jitter up to this fraction of the delay (default: 0.5 = ±50%). Set 0 to disable. */
	retryJitter?: number;
	/** Seed for deterministic case ordering. When set, cases are shuffled using this seed for reproducible runs. */
	seed?: number;
}

export interface TestSuiteCaseResult {
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

// Legacy export for backward compatibility
/** @deprecated Use TestSuiteCaseResult instead */
export type TestCaseResult = TestSuiteCaseResult;

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
	results: TestSuiteCaseResult[];
	/** Case IDs that were retried (flaky recovery) */
	retriedCases?: string[];
}

/**
 * Test definition for introspection
 * COMPAT-201: Public TestSuite introspection (minimal getters)
 */
export interface TestDefinition {
	/** Test case ID */
	id: string;
	/** Test input */
	input: string;
	/** Expected output */
	expected?: string;
	/** Test metadata */
	metadata?: Record<string, unknown>;
	/** Whether test has assertions */
	hasAssertions: boolean;
	/** Number of assertions */
	assertionCount: number;
}

/**
 * Portable suite representation
 * COMPAT-201: Public TestSuite introspection (minimal getters)
 */
export interface PortableSuite {
	/** Suite name */
	name: string;
	/** Suite configuration */
	config: TestSuiteConfig;
	/** Test definitions */
	tests: TestDefinition[];
	/** Suite metadata */
	metadata: {
		suiteName?: string;
		tags?: string[];
		defaults?: {
			timeout?: number;
			parallel?: boolean;
			stopOnFailure?: boolean;
			retries?: number;
		};
	};
}

/**
 * Test Suite for declarative evaluation testing
 */
export class TestSuite {
	constructor(
		private name: string,
		private config: TestSuiteConfig,
	) {}

	/**
	 * Run all test cases
	 *
	 * @example
	 * ```typescript
	 * const results = await suite.run();
	 * console.log(`${results.passed}/${results.total} tests passed`);
	 * ```
	 */
	async run(): Promise<TestSuiteResult> {
		const startTime = Date.now();
		const results: TestSuiteCaseResult[] = [];

		// Deterministic shuffle when seed is provided
		const orderedCases = this.config.cases.map((c, i) => ({
			case: c,
			originalIndex: i,
		}));
		if (this.config.seed !== undefined) {
			// mulberry32 seeded PRNG
			let s = this.config.seed | 0;
			const rand = (): number => {
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

		const runTestCase = async (
			testCase: TestSuiteCase,
			index: number,
		): Promise<TestSuiteCaseResult> => {
			const caseStartTime = Date.now();
			const id = testCase.id || `case-${index}`;

			try {
				// Execute to get output
				let actual: string;
				if (this.config.executor) {
					const timeout = this.config.timeout || 30000;
					const timeoutPromise = new Promise<never>((_, reject) =>
						setTimeout(
							() => reject(new Error(`Test timeout after ${timeout}ms`)),
							timeout,
						),
					);

					actual = await Promise.race([
						this.config.executor(testCase.input),
						timeoutPromise,
					]);
				} else if (testCase.expected) {
					actual = testCase.expected; // Use expected as actual if no executor
				} else {
					throw new Error("No executor provided and no expected output");
				}

				// Run assertions
				const assertions: AssertionResult[] = [];
				let allPassed = true;

				// Run custom assertions
				if (testCase.assertions) {
					for (const assertion of testCase.assertions) {
						const result = assertion(actual);
						assertions.push(result);
						if (!result.passed) allPassed = false;
					}
				}

				// Default equality check if expected provided
				if (testCase.expected && !testCase.assertions) {
					const result = expect(actual).toEqual(testCase.expected);
					assertions.push(result);
					if (!result.passed) allPassed = false;
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
			} catch (error) {
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
			results.push(
				...(await Promise.all(
					orderedCases.map((oc) => runTestCase(oc.case, oc.originalIndex)),
				)),
			);
		} else {
			for (const oc of orderedCases) {
				const result = await runTestCase(oc.case, oc.originalIndex);
				results.push(result);

				if (
					(this.config.stopOnFailure || this.config.strict) &&
					!result.passed
				) {
					break;
				}
			}
		}

		const retriedCases: string[] = [];
		const retries = this.config.retries ?? 0;
		const baseDelay = this.config.retryDelayMs ?? 500;
		const jitterFraction = this.config.retryJitter ?? 0.5;
		if (retries > 0 && results.length > 0) {
			const failingIndices = results
				.map((r, i) => (r.passed ? -1 : i))
				.filter((i) => i >= 0);
			for (
				let attempt = 0;
				attempt < retries && failingIndices.length > 0;
				attempt++
			) {
				// Exponential backoff with jitter before each retry round
				const delay = baseDelay * 2 ** attempt;
				const jitter =
					jitterFraction > 0
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
					const originalCase = orderedCases.find(
						(oc) => (oc.case.id || `case-${oc.originalIndex}`) === tc.id,
					);
					if (!originalCase) continue;
					const retryResult = await runTestCase(
						originalCase.case,
						originalCase.originalIndex,
					);
					if (retryResult.passed) {
						results[idx] = retryResult;
						retriedCases.push(retryResult.id);
					} else {
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
	addCase(testCase: TestSuiteCase): void {
		this.config.cases.push(testCase);
	}

	/**
	 * Get suite configuration
	 */
	getConfig(): TestSuiteConfig {
		return { ...this.config };
	}

	/**
	 * Get test definitions for introspection
	 * COMPAT-201: Public TestSuite introspection (minimal getters)
	 */
	getTests(): TestDefinition[] {
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
	getMetadata(): {
		suiteName?: string;
		tags?: string[];
		defaults?: {
			timeout?: number;
			parallel?: boolean;
			stopOnFailure?: boolean;
			retries?: number;
		};
	} {
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
	toJSON(): PortableSuite {
		return {
			name: this.name,
			config: this.getConfig(),
			tests: this.getTests(),
			metadata: this.getMetadata(),
		};
	}
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
export function createTestSuite(
	name: string,
	config: TestSuiteConfig,
): TestSuite {
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
export function containsKeywords(
	keywords: string[],
): (output: string) => AssertionResult {
	return (output) => expect(output).toContainKeywords(keywords);
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
export function matchesPattern(
	pattern: RegExp,
): (output: string) => AssertionResult {
	return (output) => expect(output).toMatchPattern(pattern);
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
export function hasSentiment(
	sentiment: "positive" | "negative" | "neutral",
): (output: string) => AssertionResult {
	return (output) => expect(output).toHaveSentiment(sentiment);
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
export function hasLength(range: {
	min?: number;
	max?: number;
}): (output: string) => AssertionResult {
	return (output) => expect(output).toHaveLength(range);
}
