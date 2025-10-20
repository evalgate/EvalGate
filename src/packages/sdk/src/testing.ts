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

import { expect, AssertionResult } from './assertions';

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
  metadata?: Record<string, any>;
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
}

/**
 * Test Suite for declarative evaluation testing
 */
export class TestSuite {
  constructor(
    private name: string,
    private config: TestSuiteConfig
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
    
    const runTestCase = async (testCase: TestSuiteCase, index: number): Promise<TestSuiteCaseResult> => {
      const caseStartTime = Date.now();
      const id = testCase.id || `case-${index}`;
      
      try {
        // Execute to get output
        let actual: string;
        if (this.config.executor) {
          const timeout = this.config.timeout || 30000;
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
          );
          
          actual = await Promise.race([
            this.config.executor(testCase.input),
            timeoutPromise
          ]);
        } else if (testCase.expected) {
          actual = testCase.expected; // Use expected as actual if no executor
        } else {
          throw new Error('No executor provided and no expected output');
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
          durationMs
        };
      } catch (error) {
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
      results.push(...await Promise.all(
        this.config.cases.map((tc, i) => runTestCase(tc, i))
      ));
    } else {
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
  addCase(testCase: TestSuiteCase): void {
    this.config.cases.push(testCase);
  }

  /**
   * Get suite configuration
   */
  getConfig(): TestSuiteConfig {
    return { ...this.config };
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
export function createTestSuite(name: string, config: TestSuiteConfig): TestSuite {
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
export function containsKeywords(keywords: string[]): (output: string) => AssertionResult {
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
export function matchesPattern(pattern: RegExp): (output: string) => AssertionResult {
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
export function hasSentiment(sentiment: 'positive' | 'negative' | 'neutral'): (output: string) => AssertionResult {
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
export function hasLength(range: { min?: number; max?: number }): (output: string) => AssertionResult {
  return (output) => expect(output).toHaveLength(range);
}