/**
 * Enhanced Assertion Library
 * Tier 1.3: Pre-Built Assertion Library with 20+ built-in assertions
 *
 * @example
 * ```typescript
 * import { expect } from '@ai-eval-platform/sdk';
 *
 * const output = "Hello, how can I help you today?";
 *
 * expect(output).toContainKeywords(['help', 'today']);
 * expect(output).toHaveSentiment('positive');
 * expect(output).toMatchPattern(/help/i);
 * expect(output).toHaveLength({ min: 10, max: 100 });
 * ```
 */
export interface AssertionResult {
    name: string;
    passed: boolean;
    expected: any;
    actual: any;
    message?: string;
}
export declare class AssertionError extends Error {
    expected: any;
    actual: any;
    constructor(message: string, expected: any, actual: any);
}
/**
 * Fluent assertion builder
 */
export declare class Expectation {
    private value;
    constructor(value: any);
    /**
     * Assert value equals expected
     * @example expect(output).toEqual("Hello")
     */
    toEqual(expected: any, message?: string): AssertionResult;
    /**
     * Assert value contains substring
     * @example expect(output).toContain("help")
     */
    toContain(substring: string, message?: string): AssertionResult;
    /**
     * Assert value contains all keywords
     * @example expect(output).toContainKeywords(['help', 'support'])
     */
    toContainKeywords(keywords: string[], message?: string): AssertionResult;
    /**
     * Assert value does not contain substring
     * @example expect(output).toNotContain("error")
     */
    toNotContain(substring: string, message?: string): AssertionResult;
    /**
     * Assert value does not contain PII (emails, phone numbers, SSN)
     * @example expect(output).toNotContainPII()
     */
    toNotContainPII(message?: string): AssertionResult;
    /**
     * Assert value matches regular expression
     * @example expect(output).toMatchPattern(/\d{3}-\d{3}-\d{4}/)
     */
    toMatchPattern(pattern: RegExp, message?: string): AssertionResult;
    /**
     * Assert value is valid JSON
     * @example expect(output).toBeValidJSON()
     */
    toBeValidJSON(message?: string): AssertionResult;
    /**
     * Assert JSON matches schema
     * @example expect(output).toMatchJSON({ status: 'success' })
     */
    toMatchJSON(schema: Record<string, any>, message?: string): AssertionResult;
    /**
     * Assert value has expected sentiment
     * @example expect(output).toHaveSentiment('positive')
     */
    toHaveSentiment(expected: 'positive' | 'negative' | 'neutral', message?: string): AssertionResult;
    /**
     * Assert string length is within range
     * @example expect(output).toHaveLength({ min: 10, max: 100 })
     */
    toHaveLength(range: {
        min?: number;
        max?: number;
    }, message?: string): AssertionResult;
    /**
     * Assert no hallucinations (all ground truth facts present)
     * @example expect(output).toNotHallucinate(['fact1', 'fact2'])
     */
    toNotHallucinate(groundTruth: string[], message?: string): AssertionResult;
    /**
     * Assert response latency is within limit
     * @example expect(durationMs).toBeFasterThan(1000)
     */
    toBeFasterThan(maxMs: number, message?: string): AssertionResult;
    /**
     * Assert value is truthy
     * @example expect(result).toBeTruthy()
     */
    toBeTruthy(message?: string): AssertionResult;
    /**
     * Assert value is falsy
     * @example expect(error).toBeFalsy()
     */
    toBeFalsy(message?: string): AssertionResult;
    /**
     * Assert value is greater than expected
     * @example expect(score).toBeGreaterThan(0.8)
     */
    toBeGreaterThan(expected: number, message?: string): AssertionResult;
    /**
     * Assert value is less than expected
     * @example expect(errorRate).toBeLessThan(0.05)
     */
    toBeLessThan(expected: number, message?: string): AssertionResult;
    /**
     * Assert value is between min and max
     * @example expect(score).toBeBetween(0, 1)
     */
    toBeBetween(min: number, max: number, message?: string): AssertionResult;
    /**
     * Assert value contains code block
     * @example expect(output).toContainCode()
     */
    toContainCode(message?: string): AssertionResult;
    /**
     * Assert value is professional tone (no profanity)
     * @example expect(output).toBeProfessional()
     */
    toBeProfessional(message?: string): AssertionResult;
    /**
     * Assert value has proper grammar (basic checks)
     * @example expect(output).toHaveProperGrammar()
     */
    toHaveProperGrammar(message?: string): AssertionResult;
}
/**
 * Create an expectation for fluent assertions
 *
 * @example
 * ```typescript
 * const output = "Hello, how can I help you?";
 *
 * expect(output).toContain("help");
 * expect(output).toHaveSentiment('positive');
 * expect(output).toHaveLength({ min: 10, max: 100 });
 * ```
 */
export declare function expect(value: any): Expectation;
/**
 * Run multiple assertions and collect results
 *
 * @example
 * ```typescript
 * const results = runAssertions([
 *   () => expect(output).toContain("help"),
 *   () => expect(output).toHaveSentiment('positive'),
 *   () => expect(output).toHaveLength({ min: 10 })
 * ]);
 *
 * const allPassed = results.every(r => r.passed);
 * ```
 */
export declare function runAssertions(assertions: (() => AssertionResult)[]): AssertionResult[];
export declare function containsKeywords(text: string, keywords: string[]): boolean;
export declare function matchesPattern(text: string, pattern: RegExp): boolean;
export declare function hasLength(text: string, range: {
    min?: number;
    max?: number;
}): boolean;
export declare function containsJSON(text: string): boolean;
export declare function notContainsPII(text: string): boolean;
export declare function hasSentiment(text: string, expected: 'positive' | 'negative' | 'neutral'): boolean;
export declare function similarTo(text1: string, text2: string, threshold?: number): boolean;
export declare function withinRange(value: number, min: number, max: number): boolean;
export declare function isValidEmail(email: string): boolean;
export declare function isValidURL(url: string): boolean;
export declare function hasNoHallucinations(text: string, groundTruth: string[]): boolean;
export declare function matchesSchema(value: any, schema: Record<string, any>): boolean;
export declare function hasReadabilityScore(text: string, minScore: number): boolean;
export declare function containsLanguage(text: string, language: string): boolean;
export declare function hasFactualAccuracy(text: string, facts: string[]): boolean;
export declare function respondedWithinTime(startTime: number, maxMs: number): boolean;
export declare function hasNoToxicity(text: string): boolean;
export declare function followsInstructions(text: string, instructions: string[]): boolean;
export declare function containsAllRequiredFields(obj: any, requiredFields: string[]): boolean;
export declare function hasValidCodeSyntax(code: string, language: string): boolean;
