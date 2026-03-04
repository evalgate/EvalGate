"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expectation = exports.AssertionError = void 0;
exports.expect = expect;
exports.runAssertions = runAssertions;
exports.containsKeywords = containsKeywords;
exports.matchesPattern = matchesPattern;
exports.hasLength = hasLength;
exports.containsJSON = containsJSON;
exports.notContainsPII = notContainsPII;
exports.hasPII = hasPII;
exports.hasSentiment = hasSentiment;
exports.similarTo = similarTo;
exports.withinRange = withinRange;
exports.isValidEmail = isValidEmail;
exports.isValidURL = isValidURL;
exports.hasNoHallucinations = hasNoHallucinations;
exports.matchesSchema = matchesSchema;
exports.hasReadabilityScore = hasReadabilityScore;
exports.containsLanguage = containsLanguage;
exports.hasFactualAccuracy = hasFactualAccuracy;
exports.respondedWithinDuration = respondedWithinDuration;
exports.respondedWithinTimeSince = respondedWithinTimeSince;
exports.respondedWithinTime = respondedWithinTime;
exports.hasNoToxicity = hasNoToxicity;
exports.followsInstructions = followsInstructions;
exports.containsAllRequiredFields = containsAllRequiredFields;
exports.configureAssertions = configureAssertions;
exports.getAssertionConfig = getAssertionConfig;
exports.hasSentimentAsync = hasSentimentAsync;
exports.hasNoToxicityAsync = hasNoToxicityAsync;
exports.containsLanguageAsync = containsLanguageAsync;
exports.hasValidCodeSyntaxAsync = hasValidCodeSyntaxAsync;
exports.hasFactualAccuracyAsync = hasFactualAccuracyAsync;
exports.hasNoHallucinationsAsync = hasNoHallucinationsAsync;
exports.hasValidCodeSyntax = hasValidCodeSyntax;
class AssertionError extends Error {
    constructor(message, expected, actual) {
        super(message);
        this.expected = expected;
        this.actual = actual;
        this.name = "AssertionError";
        Object.setPrototypeOf(this, AssertionError.prototype);
    }
}
exports.AssertionError = AssertionError;
/**
 * Fluent assertion builder
 */
class Expectation {
    constructor(value) {
        this.value = value;
    }
    /**
     * Negate the next assertion — inverts `passed` on any chained method.
     * @example expect('drop table').not.toContain('drop table')
     */
    get not() {
        const value = this.value;
        return new Proxy(new Expectation(value), {
            get(target, prop) {
                const orig = target[prop];
                if (typeof orig === "function" && prop !== "constructor") {
                    return (...args) => {
                        const result = orig.call(target, ...args);
                        if (result && typeof result === "object" && "passed" in result) {
                            return { ...result, passed: !result.passed };
                        }
                        return result;
                    };
                }
                return orig;
            },
        });
    }
    /**
     * Assert value equals expected
     * @example expect(output).toEqual("Hello")
     */
    toEqual(expected, message) {
        const passed = JSON.stringify(this.value) === JSON.stringify(expected);
        return {
            name: "toEqual",
            passed,
            expected,
            actual: this.value,
            message: message ||
                (passed
                    ? "Values are equal"
                    : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.value)}`),
        };
    }
    /**
     * Assert value contains substring
     * @example expect(output).toContain("help")
     */
    toContain(substring, message) {
        const text = String(this.value);
        const passed = text.includes(substring);
        return {
            name: "toContain",
            passed,
            expected: substring,
            actual: text,
            message: message ||
                (passed
                    ? `Text contains "${substring}"`
                    : `Text does not contain "${substring}"`),
        };
    }
    /**
     * Assert value contains all keywords
     * @example expect(output).toContainKeywords(['help', 'support'])
     */
    toContainKeywords(keywords, message) {
        const text = String(this.value).toLowerCase();
        const missingKeywords = keywords.filter((k) => !text.includes(k.toLowerCase()));
        const passed = missingKeywords.length === 0;
        return {
            name: "toContainKeywords",
            passed,
            expected: keywords,
            actual: text,
            message: message ||
                (passed
                    ? `Contains all keywords`
                    : `Missing keywords: ${missingKeywords.join(", ")}`),
        };
    }
    /**
     * Assert value does not contain substring
     * @example expect(output).toNotContain("error")
     */
    toNotContain(substring, message) {
        const text = String(this.value);
        const passed = !text.includes(substring);
        return {
            name: "toNotContain",
            passed,
            expected: `not containing "${substring}"`,
            actual: text,
            message: message ||
                (passed
                    ? `Text does not contain "${substring}"`
                    : `Text contains "${substring}"`),
        };
    }
    /**
     * Assert value does not contain PII (emails, phone numbers, SSN)
     * @example expect(output).toNotContainPII()
     */
    toNotContainPII(message) {
        const text = String(this.value);
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
        const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
        const foundPII = [];
        if (emailPattern.test(text))
            foundPII.push("email");
        if (phonePattern.test(text))
            foundPII.push("phone number");
        if (ssnPattern.test(text))
            foundPII.push("SSN");
        const passed = foundPII.length === 0;
        return {
            name: "toNotContainPII",
            passed,
            expected: "no PII",
            actual: foundPII.length > 0 ? `Found: ${foundPII.join(", ")}` : "no PII",
            message: message ||
                (passed ? "No PII detected" : `PII detected: ${foundPII.join(", ")}`),
        };
    }
    /**
     * Assert value matches regular expression
     * @example expect(output).toMatchPattern(/\d{3}-\d{3}-\d{4}/)
     */
    toMatchPattern(pattern, message) {
        const text = String(this.value);
        const passed = pattern.test(text);
        return {
            name: "toMatchPattern",
            passed,
            expected: pattern.toString(),
            actual: text,
            message: message ||
                (passed
                    ? `Matches pattern ${pattern}`
                    : `Does not match pattern ${pattern}`),
        };
    }
    /**
     * Assert value is valid JSON
     * @example expect(output).toBeValidJSON()
     */
    toBeValidJSON(message) {
        let passed = false;
        let parsedJson = null;
        try {
            parsedJson = JSON.parse(String(this.value));
            passed = true;
        }
        catch (_e) {
            passed = false;
        }
        return {
            name: "toBeValidJSON",
            passed,
            expected: "valid JSON",
            actual: passed ? parsedJson : this.value,
            message: message || (passed ? "Valid JSON" : "Invalid JSON"),
        };
    }
    /**
     * Assert JSON matches schema
     * @example expect(output).toMatchJSON({ status: 'success' })
     */
    toMatchJSON(schema, message) {
        let passed = false;
        let parsedJson = null;
        try {
            parsedJson = JSON.parse(String(this.value));
            const entries = Object.entries(schema);
            passed = entries.every(([key, expectedValue]) => parsedJson !== null &&
                key in parsedJson &&
                JSON.stringify(parsedJson[key]) === JSON.stringify(expectedValue));
        }
        catch (_e) {
            passed = false;
        }
        return {
            name: "toMatchJSON",
            passed,
            expected: schema,
            actual: parsedJson,
            message: message ||
                (passed ? "JSON matches schema" : "JSON does not match schema"),
        };
    }
    /**
     * Assert value has expected sentiment
     * @example expect(output).toHaveSentiment('positive')
     */
    toHaveSentiment(expected, message) {
        const text = String(this.value).toLowerCase();
        const positiveWords = [
            "good",
            "great",
            "excellent",
            "amazing",
            "wonderful",
            "fantastic",
            "love",
            "best",
            "happy",
            "helpful",
        ];
        const negativeWords = [
            "bad",
            "terrible",
            "awful",
            "horrible",
            "worst",
            "hate",
            "poor",
            "disappointing",
            "sad",
            "useless",
        ];
        const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
        const negativeCount = negativeWords.filter((w) => text.includes(w)).length;
        let actual;
        if (positiveCount > negativeCount)
            actual = "positive";
        else if (negativeCount > positiveCount)
            actual = "negative";
        else
            actual = "neutral";
        const passed = actual === expected;
        return {
            name: "toHaveSentiment",
            passed,
            expected,
            actual,
            message: message ||
                (passed
                    ? `Sentiment is ${expected}`
                    : `Expected ${expected}, got ${actual}`),
        };
    }
    /**
     * Assert string length is within range
     * @example expect(output).toHaveLength({ min: 10, max: 100 })
     */
    toHaveLength(range, message) {
        const length = String(this.value).length;
        const passed = (range.min === undefined || length >= range.min) &&
            (range.max === undefined || length <= range.max);
        return {
            name: "toHaveLength",
            passed,
            expected: range,
            actual: length,
            message: message ||
                (passed
                    ? `Length ${length} is within range`
                    : `Length ${length} not in range`),
        };
    }
    /**
     * Assert no hallucinations (all ground truth facts present)
     * @example expect(output).toNotHallucinate(['fact1', 'fact2'])
     */
    toNotHallucinate(groundTruth, message) {
        const text = String(this.value).toLowerCase();
        const missingFacts = groundTruth.filter((fact) => !text.includes(fact.toLowerCase()));
        const passed = missingFacts.length === 0;
        return {
            name: "toNotHallucinate",
            passed,
            expected: "all ground truth facts",
            actual: missingFacts.length > 0
                ? `Missing: ${missingFacts.join(", ")}`
                : "all facts present",
            message: message ||
                (passed
                    ? "No hallucinations detected"
                    : `Missing facts: ${missingFacts.join(", ")}`),
        };
    }
    /**
     * Assert response latency is within limit
     * @example expect(durationMs).toBeFasterThan(1000)
     */
    toBeFasterThan(maxMs, message) {
        const duration = Number(this.value);
        const passed = duration <= maxMs;
        return {
            name: "toBeFasterThan",
            passed,
            expected: `<= ${maxMs}ms`,
            actual: `${duration}ms`,
            message: message ||
                (passed
                    ? `${duration}ms within limit`
                    : `${duration}ms exceeds ${maxMs}ms`),
        };
    }
    /**
     * Assert value is truthy
     * @example expect(result).toBeTruthy()
     */
    toBeTruthy(message) {
        const passed = Boolean(this.value);
        return {
            name: "toBeTruthy",
            passed,
            expected: "truthy value",
            actual: this.value,
            message: message || (passed ? "Value is truthy" : "Value is falsy"),
        };
    }
    /**
     * Assert value is falsy
     * @example expect(error).toBeFalsy()
     */
    toBeFalsy(message) {
        const passed = !this.value;
        return {
            name: "toBeFalsy",
            passed,
            expected: "falsy value",
            actual: this.value,
            message: message || (passed ? "Value is falsy" : "Value is truthy"),
        };
    }
    /**
     * Assert value is greater than expected
     * @example expect(score).toBeGreaterThan(0.8)
     */
    toBeGreaterThan(expected, message) {
        const value = Number(this.value);
        const passed = value > expected;
        return {
            name: "toBeGreaterThan",
            passed,
            expected: `> ${expected}`,
            actual: value,
            message: message ||
                (passed ? `${value} > ${expected}` : `${value} <= ${expected}`),
        };
    }
    /**
     * Assert value is less than expected
     * @example expect(errorRate).toBeLessThan(0.05)
     */
    toBeLessThan(expected, message) {
        const value = Number(this.value);
        const passed = value < expected;
        return {
            name: "toBeLessThan",
            passed,
            expected: `< ${expected}`,
            actual: value,
            message: message ||
                (passed ? `${value} < ${expected}` : `${value} >= ${expected}`),
        };
    }
    /**
     * Assert value is between min and max
     * @example expect(score).toBeBetween(0, 1)
     */
    toBeBetween(min, max, message) {
        const value = Number(this.value);
        const passed = value >= min && value <= max;
        return {
            name: "toBeBetween",
            passed,
            expected: `between ${min} and ${max}`,
            actual: value,
            message: message ||
                (passed ? `${value} is within range` : `${value} is outside range`),
        };
    }
    /**
     * Assert value contains code block or raw code
     * @example expect(output).toContainCode()
     * @example expect(output).toContainCode('typescript')
     */
    toContainCode(language, message) {
        const text = String(this.value);
        const hasMarkdownBlock = language
            ? new RegExp(`\`\`\`${language}[\\s\\S]*?\`\`\``).test(text)
            : /```[\s\S]*?```/.test(text);
        const hasHtmlBlock = /<code>[\s\S]*?<\/code>/.test(text);
        const hasRawCode = /\bfunction\s+\w+\s*\(/.test(text) ||
            /\b(?:const|let|var)\s+\w+\s*=/.test(text) ||
            /\bclass\s+\w+/.test(text) ||
            /=>\s*[{(]/.test(text) ||
            /\bimport\s+.*\bfrom\b/.test(text) ||
            /\bexport\s+(?:default\s+)?(?:function|class|const)/.test(text) ||
            /\breturn\s+.+;/.test(text);
        const hasCodeBlock = hasMarkdownBlock || hasHtmlBlock || hasRawCode;
        return {
            name: "toContainCode",
            passed: hasCodeBlock,
            expected: language ? `code block (${language})` : "code block",
            actual: text,
            message: message || (hasCodeBlock ? "Contains code" : "No code found"),
        };
    }
    /**
     * Blocklist check for 7 common profane words. Does NOT analyze tone,
     * formality, or professional communication quality. For actual tone
     * analysis, use an LLM-backed assertion.
     * @see hasSentimentAsync for LLM-based tone checking
     * @example expect(output).toHaveNoProfanity()
     */
    toHaveNoProfanity(message) {
        const text = String(this.value).toLowerCase();
        const profanity = ["damn", "hell", "shit", "fuck", "ass", "bitch", "crap"];
        const foundProfanity = profanity.filter((word) => text.includes(word));
        const passed = foundProfanity.length === 0;
        return {
            name: "toHaveNoProfanity",
            passed,
            expected: "no profanity",
            actual: foundProfanity.length > 0
                ? `Found: ${foundProfanity.join(", ")}`
                : "clean",
            message: message ||
                (passed
                    ? "No profanity found"
                    : `Profanity detected: ${foundProfanity.join(", ")}`),
        };
    }
    /**
     * @deprecated Use {@link toHaveNoProfanity} instead. This method only
     * checks for 7 profane words — it does not analyze professional tone.
     */
    toBeProfessional(message) {
        return this.toHaveNoProfanity(message);
    }
    /**
     * Assert value has proper grammar (basic checks)
     * @example expect(output).toHaveProperGrammar()
     */
    toHaveProperGrammar(message) {
        const text = String(this.value);
        const issues = [];
        // Check for double spaces
        if (/ {2,}/.test(text))
            issues.push("double spaces");
        // Check for missing periods at end
        if (text.length > 10 && !/[.!?]$/.test(text.trim()))
            issues.push("missing ending punctuation");
        // Check for lowercase sentence starts
        if (/\.\s+[a-z]/.test(text))
            issues.push("lowercase after period");
        const passed = issues.length === 0;
        return {
            name: "toHaveProperGrammar",
            passed,
            expected: "proper grammar",
            actual: issues.length > 0 ? `Issues: ${issues.join(", ")}` : "proper grammar",
            message: message ||
                (passed ? "Proper grammar" : `Grammar issues: ${issues.join(", ")}`),
        };
    }
}
exports.Expectation = Expectation;
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
function expect(value) {
    return new Expectation(value);
}
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
function runAssertions(assertions) {
    return assertions.map((assertion) => {
        try {
            return assertion();
        }
        catch (error) {
            return {
                name: "unknown",
                passed: false,
                expected: null,
                actual: null,
                message: error instanceof Error ? error.message : "Unknown error",
            };
        }
    });
}
// Standalone assertion functions
function containsKeywords(text, keywords) {
    return keywords.every((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
}
function matchesPattern(text, pattern) {
    return pattern.test(text);
}
function hasLength(text, range) {
    const length = text.length;
    if (range.min !== undefined && length < range.min)
        return false;
    if (range.max !== undefined && length > range.max)
        return false;
    return true;
}
function containsJSON(text) {
    try {
        JSON.parse(text);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Returns `true` when the text is PII-free (safe to use), `false` when PII is detected.
 *
 * @example
 * if (!notContainsPII(response)) throw new Error("PII leak detected");
 * // Or use the clearer alias:
 * if (hasPII(response)) throw new Error("PII leak detected");
 */
function notContainsPII(text) {
    // Simple PII detection patterns
    const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b\d{3}\.\d{3}\.\d{4}\b/, // SSN with dots
        /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone (various formats)
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Email
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP address
    ];
    return !piiPatterns.some((pattern) => pattern.test(text));
}
/**
 * Returns `true` when PII is detected in the text (unsafe), `false` when safe.
 * This is the semantic inverse of `notContainsPII` and may be easier to reason about.
 *
 * @example
 * if (hasPII(response)) throw new Error("PII leak");
 */
function hasPII(text) {
    return !notContainsPII(text);
}
/**
 * Lexicon-based sentiment check. **Fast and approximate** — suitable for
 * low-stakes filtering or CI smoke tests. For production safety gates use
 * {@link hasSentimentAsync} with an LLM provider for context-aware accuracy.
 */
function hasSentiment(text, expected) {
    const lower = text.toLowerCase();
    const positiveWords = [
        "good",
        "great",
        "excellent",
        "amazing",
        "wonderful",
        "fantastic",
        "love",
        "best",
        "happy",
        "helpful",
        "awesome",
        "superb",
        "outstanding",
        "brilliant",
        "perfect",
        "delightful",
        "joyful",
        "pleased",
        "glad",
        "terrific",
        "fabulous",
        "exceptional",
        "impressive",
        "magnificent",
        "marvelous",
        "splendid",
        "positive",
        "enjoy",
        "enjoyed",
        "like",
        "liked",
        "beautiful",
        "innovative",
        "inspiring",
        "effective",
        "useful",
        "valuable",
    ];
    const negativeWords = [
        "bad",
        "terrible",
        "awful",
        "horrible",
        "worst",
        "hate",
        "poor",
        "disappointing",
        "sad",
        "useless",
        "dreadful",
        "miserable",
        "angry",
        "frustrated",
        "broken",
        "failed",
        "pathetic",
        "stupid",
        "disgusting",
        "unacceptable",
        "wrong",
        "error",
        "fail",
        "problem",
        "negative",
        "dislike",
        "annoying",
        "irritating",
        "offensive",
        "regret",
        "disappointment",
        "inadequate",
        "mediocre",
        "flawed",
        "unreliable",
    ];
    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;
    if (expected === "positive")
        return positiveCount > negativeCount;
    if (expected === "negative")
        return negativeCount > positiveCount;
    return positiveCount === negativeCount; // neutral
}
function similarTo(text1, text2, threshold = 0.8) {
    // Simple similarity check - in a real app, you'd use a proper string similarity algorithm
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size >= threshold;
}
function withinRange(value, min, max) {
    return value >= min && value <= max;
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Substring-based hallucination check — verifies each ground-truth fact
 * appears verbatim in the text. **Fast and approximate**: catches missing
 * facts but cannot detect paraphrased fabrications. Use
 * {@link hasNoHallucinationsAsync} for semantic accuracy.
 */
function hasNoHallucinations(text, groundTruth = []) {
    const lower = text.toLowerCase();
    return groundTruth.every((truth) => lower.includes(truth.toLowerCase()));
}
function matchesSchema(value, schema) {
    if (typeof value !== "object" || value === null)
        return false;
    const obj = value;
    // JSON Schema: { required: ['name', 'age'] } — check required keys exist
    if (Array.isArray(schema.required)) {
        return schema.required.every((key) => key in obj);
    }
    // JSON Schema: { properties: { name: {}, age: {} } } — check property keys exist
    if (schema.properties && typeof schema.properties === "object") {
        return Object.keys(schema.properties).every((key) => key in obj);
    }
    // Simple template format: { name: '', value: '' } — all schema keys must exist in value
    return Object.keys(schema).every((key) => key in obj);
}
function hasReadabilityScore(text, minScore) {
    const threshold = typeof minScore === "number" ? minScore : (minScore.min ?? 0);
    const maxThreshold = typeof minScore === "object" ? minScore.max : undefined;
    const wordList = text.trim().split(/\s+/).filter(Boolean);
    const words = wordList.length || 1;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
    const totalSyllables = wordList.reduce((sum, w) => sum + syllables(w), 0);
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (totalSyllables / words);
    return (score >= threshold && (maxThreshold === undefined || score <= maxThreshold));
}
function syllables(word) {
    // Simple syllable counter
    word = word.toLowerCase();
    if (word.length <= 3)
        return 1;
    return word
        .replace(/[^aeiouy]+/g, " ")
        .trim()
        .split(/\s+/).length;
}
/**
 * Keyword-frequency language detector supporting 12 languages.
 * **Fast and approximate** — detects the most common languages reliably
 * but may struggle with short texts or closely related languages.
 * Use {@link containsLanguageAsync} for reliable detection of any language.
 */
function containsLanguage(text, language) {
    const languageKeywords = {
        en: [
            "the",
            "and",
            "you",
            "that",
            "was",
            "for",
            "are",
            "with",
            "have",
            "this",
            "from",
            "they",
            "will",
            "would",
            "been",
            "their",
        ],
        es: [
            "el",
            "la",
            "los",
            "las",
            "de",
            "que",
            "y",
            "en",
            "es",
            "por",
            "para",
            "con",
            "una",
            "como",
            "pero",
            "también",
        ],
        fr: [
            "le",
            "la",
            "les",
            "de",
            "et",
            "à",
            "un",
            "une",
            "du",
            "des",
            "est",
            "que",
            "dans",
            "pour",
            "sur",
            "avec",
        ],
        de: [
            "der",
            "die",
            "das",
            "und",
            "ist",
            "ich",
            "nicht",
            "mit",
            "sie",
            "ein",
            "eine",
            "von",
            "zu",
            "auf",
            "auch",
            "dem",
        ],
        it: [
            "il",
            "di",
            "che",
            "non",
            "si",
            "per",
            "del",
            "un",
            "una",
            "con",
            "sono",
            "nel",
            "una",
            "questo",
            "come",
        ],
        pt: [
            "de",
            "que",
            "do",
            "da",
            "em",
            "um",
            "para",
            "com",
            "uma",
            "os",
            "as",
            "não",
            "mas",
            "por",
            "mais",
        ],
        nl: [
            "de",
            "het",
            "een",
            "van",
            "en",
            "in",
            "is",
            "dat",
            "op",
            "te",
            "zijn",
            "niet",
            "ook",
            "met",
            "voor",
        ],
        ru: [
            "и",
            "в",
            "не",
            "на",
            "я",
            "что",
            "с",
            "по",
            "это",
            "как",
            "но",
            "он",
            "она",
            "мы",
            "они",
        ],
        zh: [
            "的",
            "了",
            "是",
            "在",
            "我",
            "有",
            "和",
            "就",
            "不",
            "都",
            "也",
            "很",
            "会",
            "这",
            "他",
        ],
        ja: [
            "は",
            "が",
            "の",
            "に",
            "を",
            "で",
            "と",
            "た",
            "し",
            "て",
            "も",
            "な",
            "か",
            "から",
            "まで",
        ],
        ko: [
            "이",
            "은",
            "는",
            "을",
            "를",
            "의",
            "에",
            "가",
            "로",
            "도",
            "와",
            "과",
            "하",
            "있",
            "합",
        ],
        ar: [
            "في",
            "من",
            "على",
            "إلى",
            "هذا",
            "مع",
            "أن",
            "هو",
            "كان",
            "كل",
            "التي",
            "الذي",
            "عن",
            "لا",
        ],
    };
    const lang = language.toLowerCase();
    const keywords = languageKeywords[lang] || languageKeywords[lang.split("-")[0]] || [];
    return keywords.some((keyword) => text.toLowerCase().includes(keyword));
}
/**
 * Substring-based factual accuracy check. **Fast and approximate** — verifies
 * each fact string appears in the text but cannot reason about meaning or
 * paraphrasing. Use {@link hasFactualAccuracyAsync} for semantic accuracy.
 */
function hasFactualAccuracy(text, facts) {
    const lower = text.toLowerCase();
    return facts.every((fact) => lower.includes(fact.toLowerCase()));
}
/**
 * Check if a measured duration is within the allowed limit.
 * @param durationMs - The actual elapsed time in milliseconds
 * @param maxMs - Maximum allowed duration in milliseconds
 */
function respondedWithinDuration(durationMs, maxMs) {
    return durationMs <= maxMs;
}
/**
 * Check if elapsed time since a start timestamp is within the allowed limit.
 * @param startTime - Timestamp from Date.now() captured before the operation
 * @param maxMs - Maximum allowed duration in milliseconds
 */
function respondedWithinTimeSince(startTime, maxMs) {
    return Date.now() - startTime <= maxMs;
}
/**
 * @deprecated Use {@link respondedWithinDuration} (takes measured duration)
 * or {@link respondedWithinTimeSince} (takes start timestamp) instead.
 * This function takes a start timestamp, not a duration — the name is misleading.
 */
function respondedWithinTime(startTime, maxMs) {
    return respondedWithinTimeSince(startTime, maxMs);
}
/**
 * Blocklist-based toxicity check (~80 terms across 9 categories).
 * **Fast and approximate** — catches explicit harmful language but has
 * inherent gaps and context-blind false positives. Do NOT rely on this
 * alone for production content safety gates; use {@link hasNoToxicityAsync}
 * with an LLM for context-aware moderation.
 */
function hasNoToxicity(text) {
    const lower = text.toLowerCase();
    const toxicTerms = [
        // Insults and derogatory attacks
        "idiot",
        "moron",
        "imbecile",
        "dumbass",
        "dumb ass",
        "jackass",
        "dimwit",
        "nitwit",
        "halfwit",
        "numbskull",
        "bonehead",
        "blockhead",
        "scumbag",
        "dirtbag",
        "slimeball",
        "lowlife",
        "piece of shit",
        "piece of crap",
        "piece of garbage",
        "piece of trash",
        "waste of space",
        "waste of oxygen",
        // Degradation directed at people
        "you're worthless",
        "you are worthless",
        "you're useless",
        "you are useless",
        "you're pathetic",
        "you are pathetic",
        "you're disgusting",
        "you are disgusting",
        "you're nothing",
        "you are nothing",
        "you're scum",
        "you're garbage",
        "you're trash",
        "you're a loser",
        "complete loser",
        "total loser",
        "absolute loser",
        // Violence and threats
        "kill you",
        "kill yourself",
        "i'll kill",
        "i will kill",
        "gonna kill",
        "going to kill",
        "murder you",
        "i'll murder",
        "i will murder",
        "want you dead",
        "want them dead",
        "you should die",
        "hope you die",
        "hope you rot",
        "hope you suffer",
        "shoot you",
        "stab you",
        "beat you up",
        "hurt you",
        "harm you",
        "i'll hurt",
        "i will hurt",
        "i'll destroy you",
        "i will destroy you",
        "i'll end you",
        "you're dead",
        "you're going to die",
        "i know where you live",
        "i'll find you",
        "i will find you",
        // Self-harm directed at others
        "go kill yourself",
        "kys",
        "end yourself",
        "off yourself",
        "just die",
        "better off dead",
        "world is better without you",
        "no one would miss you",
        "nobody would miss you",
        "do us a favor and die",
        // Dehumanization
        "not even human",
        "barely human",
        "subhuman",
        "less than human",
        "you're vermin",
        "you're a parasite",
        "deserve to die",
        "deserve to suffer",
        "deserve pain",
        "deserve misery",
        // Hate and rejection
        "i hate you",
        "everyone hates you",
        "they all hate you",
        "no one likes you",
        "nobody likes you",
        "nobody wants you",
        "nobody cares about you",
        "no one cares about you",
        "go to hell",
        "burn in hell",
        "rot in hell",
        "drop dead",
        "go die",
        "i hope you suffer",
        // Harassment and threats
        "i'll ruin you",
        "ruin your life",
        "make your life hell",
        "i'll expose you",
        "i'll dox you",
        "i will dox you",
        "doxxing",
        "i'll come for you",
        "you'll pay for this",
        // Profanity as direct attacks
        "fuck you",
        "fuck off",
        "go fuck yourself",
        "screw you",
        "shut the fuck up",
        "to hell with you",
        // Bullying
        "you're a joke",
        "you're a laughingstock",
        "everyone is laughing at you",
        "pathetic loser",
        // Appearance attacks
        "fat pig",
        "fat slob",
        "hideous freak",
        // Mental health weaponized
        "you're crazy",
        "you're insane",
        "you're a psycho",
        "you're delusional",
        "you're mental",
        "you belong in an asylum",
        "you're a lunatic",
        // Explicit profanity used as insults
        "bastard",
        "bitch",
        "cunt",
        "asshole",
        "dipshit",
        "douchebag",
        "motherfucker",
        "fucktard",
    ];
    return !toxicTerms.some((term) => lower.includes(term));
}
function followsInstructions(text, instructions) {
    const instructionList = Array.isArray(instructions)
        ? instructions
        : [instructions];
    return instructionList.every((instruction) => {
        if (instruction.startsWith("!")) {
            return !text.includes(instruction.slice(1));
        }
        return text.includes(instruction);
    });
}
function containsAllRequiredFields(obj, requiredFields) {
    return requiredFields.every((field) => obj && typeof obj === "object" && field in obj);
}
let _assertionLLMConfig = null;
function configureAssertions(config) {
    _assertionLLMConfig = config;
}
function getAssertionConfig() {
    return _assertionLLMConfig;
}
async function callAssertionLLM(prompt, config) {
    const cfg = config ?? _assertionLLMConfig;
    if (!cfg) {
        throw new Error("No LLM config set. Call configureAssertions({ provider, apiKey }) first, or pass a config as the last argument.");
    }
    if (cfg.provider === "openai") {
        const baseUrl = cfg.baseUrl ?? "https://api.openai.com";
        const model = cfg.model ?? "gpt-4o-mini";
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cfg.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 10,
                temperature: 0,
            }),
        });
        if (!res.ok) {
            throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json());
        return data.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    }
    if (cfg.provider === "anthropic") {
        const baseUrl = cfg.baseUrl ?? "https://api.anthropic.com";
        const model = cfg.model ?? "claude-3-haiku-20240307";
        const res = await fetch(`${baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": cfg.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model,
                max_tokens: 10,
                messages: [{ role: "user", content: prompt }],
            }),
        });
        if (!res.ok) {
            throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json());
        return data.content[0]?.text?.trim().toLowerCase() ?? "";
    }
    throw new Error(`Unsupported provider: "${cfg.provider}". Use "openai" or "anthropic".`);
}
// ============================================================================
// LLM-BACKED ASYNC ASSERTION FUNCTIONS
// ============================================================================
/**
 * LLM-backed sentiment check. **Slow and accurate** — uses an LLM to
 * classify sentiment with full context awareness. Requires
 * {@link configureAssertions} or an inline `config` argument.
 * Falls back gracefully with a clear error if no API key is configured.
 */
async function hasSentimentAsync(text, expected, config) {
    const prompt = `Classify the sentiment of the following text. Reply with exactly one word — positive, negative, or neutral — and nothing else.\n\nText: "${text}"`;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === expected;
}
/**
 * LLM-backed toxicity check. **Slow and accurate** — context-aware, handles
 * sarcasm, implicit threats, and culturally specific harmful content that
 * blocklists miss. Recommended for production content safety gates.
 */
async function hasNoToxicityAsync(text, config) {
    const prompt = `Does the following text contain toxic, harmful, hateful, threatening, or abusive content? Reply with only "yes" or "no".\n\nText: "${text}"`;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === "no";
}
async function containsLanguageAsync(text, language, config) {
    const prompt = `Is the following text primarily written in ${language}? Reply with only "yes" or "no".\n\nText: "${text}"`;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === "yes";
}
async function hasValidCodeSyntaxAsync(code, language, config) {
    const prompt = `Is the following ${language} code free of syntax errors? Reply with only "yes" or "no".\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === "yes";
}
async function hasFactualAccuracyAsync(text, facts, config) {
    const factList = facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    const prompt = `Does the following text accurately convey all of these facts without contradicting or omitting any?\n\nFacts:\n${factList}\n\nText: "${text}"\n\nReply with only "yes" or "no".`;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === "yes";
}
/**
 * LLM-backed hallucination check. **Slow and accurate** — detects fabricated
 * claims even when they are paraphrased or contradict facts indirectly.
 */
async function hasNoHallucinationsAsync(text, groundTruth, config) {
    const truthList = groundTruth.map((f, i) => `${i + 1}. ${f}`).join("\n");
    const prompt = `Does the following text stay consistent with the ground truth facts below, without introducing fabricated or hallucinated claims?\n\nGround truth:\n${truthList}\n\nText: "${text}"\n\nReply with only "yes" or "no".`;
    const result = await callAssertionLLM(prompt, config);
    return result.replace(/[^a-z]/g, "") === "yes";
}
function hasValidCodeSyntax(code, language) {
    const lang = language.toLowerCase();
    if (lang === "json") {
        try {
            JSON.parse(code);
            return true;
        }
        catch {
            return false;
        }
    }
    // Bracket, brace, and parenthesis balance check with string/comment awareness.
    // Catches unmatched delimiters in JS, TS, Python, Java, C, Go, Rust, and most languages.
    // Template literals (backtick strings) are treated as opaque — their entire
    // content including ${...} expressions is skipped, so braces inside them
    // do not affect the balance count. This is intentional and correct.
    // Use hasValidCodeSyntaxAsync for deeper semantic analysis.
    const stack = [];
    const pairs = { ")": "(", "]": "[", "}": "{" };
    const opens = new Set(["(", "[", "{"]);
    const closes = new Set([")", "]", "}"]);
    const isPythonLike = lang === "python" || lang === "py" || lang === "ruby" || lang === "rb";
    const isJSLike = lang === "javascript" ||
        lang === "js" ||
        lang === "typescript" ||
        lang === "ts";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplateLiteral = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        const next = code[i + 1] ?? "";
        const prev = code[i - 1] ?? "";
        if (inLineComment) {
            if (ch === "\n")
                inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (ch === "*" && next === "/") {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inSingleQuote) {
            if (ch === "'" && prev !== "\\")
                inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (ch === '"' && prev !== "\\")
                inDoubleQuote = false;
            continue;
        }
        if (inTemplateLiteral) {
            if (ch === "`" && prev !== "\\")
                inTemplateLiteral = false;
            continue;
        }
        if (ch === "/" && next === "/") {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === "/" && next === "*") {
            inBlockComment = true;
            i++;
            continue;
        }
        if (isPythonLike && ch === "#") {
            inLineComment = true;
            continue;
        }
        if (ch === "'") {
            inSingleQuote = true;
            continue;
        }
        if (ch === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (isJSLike && ch === "`") {
            inTemplateLiteral = true;
            continue;
        }
        if (opens.has(ch)) {
            stack.push(ch);
        }
        else if (closes.has(ch)) {
            if (stack.length === 0 || stack[stack.length - 1] !== pairs[ch]) {
                return false;
            }
            stack.pop();
        }
    }
    return stack.length === 0;
}
