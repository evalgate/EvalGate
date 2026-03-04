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
    expected: unknown;
    actual: unknown;
    message?: string;
}
export declare class AssertionError extends Error {
    expected: unknown;
    actual: unknown;
    constructor(message: string, expected: unknown, actual: unknown);
}
/**
 * Fluent assertion builder
 */
export declare class Expectation {
    private value;
    constructor(value: unknown);
    /**
     * Negate the next assertion — inverts `passed` on any chained method.
     * @example expect('drop table').not.toContain('drop table')
     */
    get not(): Expectation;
    /**
     * Assert value equals expected
     * @example expect(output).toEqual("Hello")
     */
    toEqual(expected: unknown, message?: string): AssertionResult;
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
    toMatchJSON(schema: Record<string, unknown>, message?: string): AssertionResult;
    /**
     * Assert value has expected sentiment
     * @example expect(output).toHaveSentiment('positive')
     */
    toHaveSentiment(expected: "positive" | "negative" | "neutral", message?: string): AssertionResult;
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
     * Assert value contains code block or raw code
     * @example expect(output).toContainCode()
     * @example expect(output).toContainCode('typescript')
     */
    toContainCode(language?: string, message?: string): AssertionResult;
    /**
     * Blocklist check for 7 common profane words. Does NOT analyze tone,
     * formality, or professional communication quality. For actual tone
     * analysis, use an LLM-backed assertion.
     * @see hasSentimentAsync for LLM-based tone checking
     * @example expect(output).toHaveNoProfanity()
     */
    toHaveNoProfanity(message?: string): AssertionResult;
    /**
     * @deprecated Use {@link toHaveNoProfanity} instead. This method only
     * checks for 7 profane words — it does not analyze professional tone.
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
export declare function expect(value: unknown): Expectation;
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
/**
 * Returns `true` when the text is PII-free (safe to use), `false` when PII is detected.
 *
 * @example
 * if (!notContainsPII(response)) throw new Error("PII leak detected");
 * // Or use the clearer alias:
 * if (hasPII(response)) throw new Error("PII leak detected");
 */
export declare function notContainsPII(text: string): boolean;
/**
 * Returns `true` when PII is detected in the text (unsafe), `false` when safe.
 * This is the semantic inverse of `notContainsPII` and may be easier to reason about.
 *
 * @example
 * if (hasPII(response)) throw new Error("PII leak");
 */
export declare function hasPII(text: string): boolean;
/**
 * Lexicon-based sentiment check. **Fast and approximate** — suitable for
 * low-stakes filtering or CI smoke tests. For production safety gates use
 * {@link hasSentimentAsync} with an LLM provider for context-aware accuracy.
 */
export declare function hasSentiment(text: string, expected: "positive" | "negative" | "neutral"): boolean;
export declare function similarTo(text1: string, text2: string, threshold?: number): boolean;
export declare function withinRange(value: number, min: number, max: number): boolean;
export declare function isValidEmail(email: string): boolean;
export declare function isValidURL(url: string): boolean;
/**
 * Substring-based hallucination check — verifies each ground-truth fact
 * appears verbatim in the text. **Fast and approximate**: catches missing
 * facts but cannot detect paraphrased fabrications. Use
 * {@link hasNoHallucinationsAsync} for semantic accuracy.
 */
export declare function hasNoHallucinations(text: string, groundTruth?: string[]): boolean;
export declare function matchesSchema(value: unknown, schema: Record<string, unknown>): boolean;
export declare function hasReadabilityScore(text: string, minScore: number | {
    min?: number;
    max?: number;
}): boolean;
/**
 * Keyword-frequency language detector supporting 12 languages.
 * **Fast and approximate** — detects the most common languages reliably
 * but may struggle with short texts or closely related languages.
 * Use {@link containsLanguageAsync} for reliable detection of any language.
 */
export declare function containsLanguage(text: string, language: string): boolean;
/**
 * Substring-based factual accuracy check. **Fast and approximate** — verifies
 * each fact string appears in the text but cannot reason about meaning or
 * paraphrasing. Use {@link hasFactualAccuracyAsync} for semantic accuracy.
 */
export declare function hasFactualAccuracy(text: string, facts: string[]): boolean;
/**
 * Check if a measured duration is within the allowed limit.
 * @param durationMs - The actual elapsed time in milliseconds
 * @param maxMs - Maximum allowed duration in milliseconds
 */
export declare function respondedWithinDuration(durationMs: number, maxMs: number): boolean;
/**
 * Check if elapsed time since a start timestamp is within the allowed limit.
 * @param startTime - Timestamp from Date.now() captured before the operation
 * @param maxMs - Maximum allowed duration in milliseconds
 */
export declare function respondedWithinTimeSince(startTime: number, maxMs: number): boolean;
/**
 * @deprecated Use {@link respondedWithinDuration} (takes measured duration)
 * or {@link respondedWithinTimeSince} (takes start timestamp) instead.
 * This function takes a start timestamp, not a duration — the name is misleading.
 */
export declare function respondedWithinTime(startTime: number, maxMs: number): boolean;
/**
 * Blocklist-based toxicity check (~80 terms across 9 categories).
 * **Fast and approximate** — catches explicit harmful language but has
 * inherent gaps and context-blind false positives. Do NOT rely on this
 * alone for production content safety gates; use {@link hasNoToxicityAsync}
 * with an LLM for context-aware moderation.
 */
export declare function hasNoToxicity(text: string): boolean;
export declare function followsInstructions(text: string, instructions: string | string[]): boolean;
export declare function containsAllRequiredFields(obj: unknown, requiredFields: string[]): boolean;
export interface AssertionLLMConfig {
    provider: "openai" | "anthropic";
    apiKey: string;
    model?: string;
    baseUrl?: string;
}
export declare function configureAssertions(config: AssertionLLMConfig): void;
export declare function getAssertionConfig(): AssertionLLMConfig | null;
/**
 * LLM-backed sentiment check. **Slow and accurate** — uses an LLM to
 * classify sentiment with full context awareness. Requires
 * {@link configureAssertions} or an inline `config` argument.
 * Falls back gracefully with a clear error if no API key is configured.
 */
export declare function hasSentimentAsync(text: string, expected: "positive" | "negative" | "neutral", config?: AssertionLLMConfig): Promise<boolean>;
/**
 * LLM-backed toxicity check. **Slow and accurate** — context-aware, handles
 * sarcasm, implicit threats, and culturally specific harmful content that
 * blocklists miss. Recommended for production content safety gates.
 */
export declare function hasNoToxicityAsync(text: string, config?: AssertionLLMConfig): Promise<boolean>;
export declare function containsLanguageAsync(text: string, language: string, config?: AssertionLLMConfig): Promise<boolean>;
export declare function hasValidCodeSyntaxAsync(code: string, language: string, config?: AssertionLLMConfig): Promise<boolean>;
export declare function hasFactualAccuracyAsync(text: string, facts: string[], config?: AssertionLLMConfig): Promise<boolean>;
/**
 * LLM-backed hallucination check. **Slow and accurate** — detects fabricated
 * claims even when they are paraphrased or contradict facts indirectly.
 */
export declare function hasNoHallucinationsAsync(text: string, groundTruth: string[], config?: AssertionLLMConfig): Promise<boolean>;
export declare function hasValidCodeSyntax(code: string, language: string): boolean;
