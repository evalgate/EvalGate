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

export class AssertionError extends Error {
  constructor(
    message: string,
    public expected: any,
    public actual: any,
  ) {
    super(message);
    this.name = "AssertionError";
    Object.setPrototypeOf(this, AssertionError.prototype);
  }
}

/**
 * Fluent assertion builder
 */
export class Expectation {
  constructor(private value: any) {}

  /**
   * Assert value equals expected
   * @example expect(output).toEqual("Hello")
   */
  toEqual(expected: any, message?: string): AssertionResult {
    const passed = JSON.stringify(this.value) === JSON.stringify(expected);
    return {
      name: "toEqual",
      passed,
      expected,
      actual: this.value,
      message: message || (passed ? "Values are equal" : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.value)}`)
    };
  }

  /**
   * Assert value contains substring
   * @example expect(output).toContain("help")
   */
  toContain(substring: string, message?: string): AssertionResult {
    const text = String(this.value);
    const passed = text.includes(substring);
    return {
      name: "toContain",
      passed,
      expected: substring,
      actual: text,
      message: message || (passed ? `Text contains "${substring}"` : `Text does not contain "${substring}"`)
    };
  }

  /**
   * Assert value contains all keywords
   * @example expect(output).toContainKeywords(['help', 'support'])
   */
  toContainKeywords(keywords: string[], message?: string): AssertionResult {
    const text = String(this.value).toLowerCase();
    const missingKeywords = keywords.filter(k => !text.includes(k.toLowerCase()));
    const passed = missingKeywords.length === 0;
    return {
      name: "toContainKeywords",
      passed,
      expected: keywords,
      actual: text,
      message: message || (passed ? `Contains all keywords` : `Missing keywords: ${missingKeywords.join(', ')}`)
    };
  }

  /**
   * Assert value does not contain substring
   * @example expect(output).toNotContain("error")
   */
  toNotContain(substring: string, message?: string): AssertionResult {
    const text = String(this.value);
    const passed = !text.includes(substring);
    return {
      name: "toNotContain",
      passed,
      expected: `not containing "${substring}"`,
      actual: text,
      message: message || (passed ? `Text does not contain "${substring}"` : `Text contains "${substring}"`)
    };
  }

  /**
   * Assert value does not contain PII (emails, phone numbers, SSN)
   * @example expect(output).toNotContainPII()
   */
  toNotContainPII(message?: string): AssertionResult {
    const text = String(this.value);
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
    
    const foundPII = [];
    if (emailPattern.test(text)) foundPII.push('email');
    if (phonePattern.test(text)) foundPII.push('phone number');
    if (ssnPattern.test(text)) foundPII.push('SSN');
    
    const passed = foundPII.length === 0;
    return {
      name: "toNotContainPII",
      passed,
      expected: "no PII",
      actual: foundPII.length > 0 ? `Found: ${foundPII.join(', ')}` : "no PII",
      message: message || (passed ? "No PII detected" : `PII detected: ${foundPII.join(', ')}`)
    };
  }

  /**
   * Assert value matches regular expression
   * @example expect(output).toMatchPattern(/\d{3}-\d{3}-\d{4}/)
   */
  toMatchPattern(pattern: RegExp, message?: string): AssertionResult {
    const text = String(this.value);
    const passed = pattern.test(text);
    return {
      name: "toMatchPattern",
      passed,
      expected: pattern.toString(),
      actual: text,
      message: message || (passed ? `Matches pattern ${pattern}` : `Does not match pattern ${pattern}`)
    };
  }

  /**
   * Assert value is valid JSON
   * @example expect(output).toBeValidJSON()
   */
  toBeValidJSON(message?: string): AssertionResult {
    let passed = false;
    let parsedJson = null;

    try {
      parsedJson = JSON.parse(String(this.value));
      passed = true;
    } catch (e) {
      passed = false;
    }

    return {
      name: "toBeValidJSON",
      passed,
      expected: "valid JSON",
      actual: passed ? parsedJson : this.value,
      message: message || (passed ? "Valid JSON" : "Invalid JSON")
    };
  }

  /**
   * Assert JSON matches schema
   * @example expect(output).toMatchJSON({ status: 'success' })
   */
  toMatchJSON(schema: Record<string, any>, message?: string): AssertionResult {
    let passed = false;
    let parsedJson = null;

    try {
      parsedJson = JSON.parse(String(this.value));
      const requiredKeys = Object.keys(schema);
      const actualKeys = Object.keys(parsedJson);
      passed = requiredKeys.every(key => actualKeys.includes(key));
    } catch (e) {
      passed = false;
    }

    return {
      name: "toMatchJSON",
      passed,
      expected: schema,
      actual: parsedJson,
      message: message || (passed ? "JSON matches schema" : "JSON does not match schema")
    };
  }

  /**
   * Assert value has expected sentiment
   * @example expect(output).toHaveSentiment('positive')
   */
  toHaveSentiment(expected: 'positive' | 'negative' | 'neutral', message?: string): AssertionResult {
    const text = String(this.value).toLowerCase();
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'happy', 'helpful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'poor', 'disappointing', 'sad', 'useless'];

    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;

    let actual: 'positive' | 'negative' | 'neutral';
    if (positiveCount > negativeCount) actual = 'positive';
    else if (negativeCount > positiveCount) actual = 'negative';
    else actual = 'neutral';

    const passed = actual === expected;
    return {
      name: "toHaveSentiment",
      passed,
      expected,
      actual,
      message: message || (passed ? `Sentiment is ${expected}` : `Expected ${expected}, got ${actual}`)
    };
  }

  /**
   * Assert string length is within range
   * @example expect(output).toHaveLength({ min: 10, max: 100 })
   */
  toHaveLength(range: { min?: number; max?: number }, message?: string): AssertionResult {
    const length = String(this.value).length;
    const passed = (range.min === undefined || length >= range.min) && 
                   (range.max === undefined || length <= range.max);
    return {
      name: "toHaveLength",
      passed,
      expected: range,
      actual: length,
      message: message || (passed ? `Length ${length} is within range` : `Length ${length} not in range`)
    };
  }

  /**
   * Assert no hallucinations (all ground truth facts present)
   * @example expect(output).toNotHallucinate(['fact1', 'fact2'])
   */
  toNotHallucinate(groundTruth: string[], message?: string): AssertionResult {
    const text = String(this.value).toLowerCase();
    const missingFacts = groundTruth.filter(fact => !text.includes(fact.toLowerCase()));
    const passed = missingFacts.length === 0;
    return {
      name: "toNotHallucinate",
      passed,
      expected: "all ground truth facts",
      actual: missingFacts.length > 0 ? `Missing: ${missingFacts.join(', ')}` : "all facts present",
      message: message || (passed ? "No hallucinations detected" : `Missing facts: ${missingFacts.join(', ')}`)
    };
  }

  /**
   * Assert response latency is within limit
   * @example expect(durationMs).toBeFasterThan(1000)
   */
  toBeFasterThan(maxMs: number, message?: string): AssertionResult {
    const duration = Number(this.value);
    const passed = duration <= maxMs;
    return {
      name: "toBeFasterThan",
      passed,
      expected: `<= ${maxMs}ms`,
      actual: `${duration}ms`,
      message: message || (passed ? `${duration}ms within limit` : `${duration}ms exceeds ${maxMs}ms`)
    };
  }

  /**
   * Assert value is truthy
   * @example expect(result).toBeTruthy()
   */
  toBeTruthy(message?: string): AssertionResult {
    const passed = Boolean(this.value);
    return {
      name: "toBeTruthy",
      passed,
      expected: "truthy value",
      actual: this.value,
      message: message || (passed ? "Value is truthy" : "Value is falsy")
    };
  }

  /**
   * Assert value is falsy
   * @example expect(error).toBeFalsy()
   */
  toBeFalsy(message?: string): AssertionResult {
    const passed = !Boolean(this.value);
    return {
      name: "toBeFalsy",
      passed,
      expected: "falsy value",
      actual: this.value,
      message: message || (passed ? "Value is falsy" : "Value is truthy")
    };
  }

  /**
   * Assert value is greater than expected
   * @example expect(score).toBeGreaterThan(0.8)
   */
  toBeGreaterThan(expected: number, message?: string): AssertionResult {
    const value = Number(this.value);
    const passed = value > expected;
    return {
      name: "toBeGreaterThan",
      passed,
      expected: `> ${expected}`,
      actual: value,
      message: message || (passed ? `${value} > ${expected}` : `${value} <= ${expected}`)
    };
  }

  /**
   * Assert value is less than expected
   * @example expect(errorRate).toBeLessThan(0.05)
   */
  toBeLessThan(expected: number, message?: string): AssertionResult {
    const value = Number(this.value);
    const passed = value < expected;
    return {
      name: "toBeLessThan",
      passed,
      expected: `< ${expected}`,
      actual: value,
      message: message || (passed ? `${value} < ${expected}` : `${value} >= ${expected}`)
    };
  }

  /**
   * Assert value is between min and max
   * @example expect(score).toBeBetween(0, 1)
   */
  toBeBetween(min: number, max: number, message?: string): AssertionResult {
    const value = Number(this.value);
    const passed = value >= min && value <= max;
    return {
      name: "toBeBetween",
      passed,
      expected: `between ${min} and ${max}`,
      actual: value,
      message: message || (passed ? `${value} is within range` : `${value} is outside range`)
    };
  }

  /**
   * Assert value contains code block
   * @example expect(output).toContainCode()
   */
  toContainCode(message?: string): AssertionResult {
    const text = String(this.value);
    const hasCodeBlock = /```[\s\S]*?```/.test(text) || /<code>[\s\S]*?<\/code>/.test(text);
    return {
      name: "toContainCode",
      passed: hasCodeBlock,
      expected: "code block",
      actual: text,
      message: message || (hasCodeBlock ? "Contains code block" : "No code block found")
    };
  }

  /**
   * Assert value is professional tone (no profanity)
   * @example expect(output).toBeProfessional()
   */
  toBeProfessional(message?: string): AssertionResult {
    const text = String(this.value).toLowerCase();
    const profanity = ['damn', 'hell', 'shit', 'fuck', 'ass', 'bitch', 'crap'];
    const foundProfanity = profanity.filter(word => text.includes(word));
    const passed = foundProfanity.length === 0;
    return {
      name: "toBeProfessional",
      passed,
      expected: "professional tone",
      actual: foundProfanity.length > 0 ? `Found: ${foundProfanity.join(', ')}` : "professional",
      message: message || (passed ? "Professional tone" : `Unprofessional language: ${foundProfanity.join(', ')}`)
    };
  }

  /**
   * Assert value has proper grammar (basic checks)
   * @example expect(output).toHaveProperGrammar()
   */
  toHaveProperGrammar(message?: string): AssertionResult {
    const text = String(this.value);
    const issues = [];
    
    // Check for double spaces
    if (/  +/.test(text)) issues.push('double spaces');
    
    // Check for missing periods at end
    if (text.length > 10 && !/[.!?]$/.test(text.trim())) issues.push('missing ending punctuation');
    
    // Check for lowercase sentence starts
    if (/\.\s+[a-z]/.test(text)) issues.push('lowercase after period');
    
    const passed = issues.length === 0;
    return {
      name: "toHaveProperGrammar",
      passed,
      expected: "proper grammar",
      actual: issues.length > 0 ? `Issues: ${issues.join(', ')}` : "proper grammar",
      message: message || (passed ? "Proper grammar" : `Grammar issues: ${issues.join(', ')}`)
    };
  }
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
export function expect(value: any): Expectation {
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
export function runAssertions(assertions: (() => AssertionResult)[]): AssertionResult[] {
  return assertions.map((assertion) => {
    try {
      return assertion();
    } catch (error) {
      return {
        name: "unknown",
        passed: false,
        expected: null,
        actual: null,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
}

// Standalone assertion functions
export function containsKeywords(text: string, keywords: string[]): boolean {
  return keywords.every(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}

export function matchesPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function hasLength(text: string, range: { min?: number; max?: number }): boolean {
  const length = text.length;
  if (range.min !== undefined && length < range.min) return false;
  if (range.max !== undefined && length > range.max) return false;
  return true;
}

export function containsJSON(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function notContainsPII(text: string): boolean {
  // Simple PII detection patterns
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{3}\.\d{3}\.\d{4}\b/, // SSN with dots
    /\b\d{10}\b/, // Phone number
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP address
  ];
  return !piiPatterns.some(pattern => pattern.test(text));
}

export function hasSentiment(text: string, expected: 'positive' | 'negative' | 'neutral'): boolean {
  // This is a simplified implementation
  const positiveWords = ['good', 'great', 'excellent', 'awesome'];
  const negativeWords = ['bad', 'terrible', 'awful', 'poor'];
  
  const words = text.toLowerCase().split(/\s+/);
  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  
  if (expected === 'positive') return positiveCount > negativeCount;
  if (expected === 'negative') return negativeCount > positiveCount;
  return positiveCount === negativeCount; // neutral
}

export function similarTo(text1: string, text2: string, threshold = 0.8): boolean {
  // Simple similarity check - in a real app, you'd use a proper string similarity algorithm
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size >= threshold;
}

export function withinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function hasNoHallucinations(text: string, groundTruth: string[]): boolean {
  // This is a simplified implementation
  return groundTruth.every(truth => text.includes(truth));
}

export function matchesSchema(value: any, schema: Record<string, any>): boolean {
  // This is a simplified implementation
  if (typeof value !== 'object' || value === null) return false;
  return Object.keys(schema).every(key => key in value);
}

export function hasReadabilityScore(text: string, minScore: number): boolean {
  // This is a simplified implementation
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).length;
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables(text) / words);
  return score >= minScore;
}

function syllables(word: string): number {
  // Simple syllable counter
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  return word.replace(/[^aeiouy]+/g, ' ').trim().split(/\s+/).length;
}

export function containsLanguage(text: string, language: string): boolean {
  // This is a simplified implementation
  // In a real app, you'd use a language detection library
  const languageKeywords: Record<string, string[]> = {
    'en': ['the', 'and', 'you', 'that', 'was', 'for', 'are', 'with'],
    'es': ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en'],
    'fr': ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une'],
  };
  
  const keywords = languageKeywords[language.toLowerCase()] || [];
  return keywords.some(keyword => text.toLowerCase().includes(keyword));
}

export function hasFactualAccuracy(text: string, facts: string[]): boolean {
  // This is a simplified implementation
  return facts.every(fact => text.includes(fact));
}

export function respondedWithinTime(startTime: number, maxMs: number): boolean {
  return Date.now() - startTime <= maxMs;
}

export function hasNoToxicity(text: string): boolean {
  // This is a simplified implementation
  const toxicWords = ['hate', 'stupid', 'idiot', 'dumb'];
  return !toxicWords.some(word => text.toLowerCase().includes(word));
}

export function followsInstructions(text: string, instructions: string[]): boolean {
  return instructions.every(instruction => {
    if (instruction.startsWith('!')) {
      return !text.includes(instruction.slice(1));
    }
    return text.includes(instruction);
  });
}

export function containsAllRequiredFields(obj: any, requiredFields: string[]): boolean {
  return requiredFields.every(field => field in obj);
}

export function hasValidCodeSyntax(code: string, language: string): boolean {
  // This is a simplified implementation
  // In a real app, you'd use a proper parser for each language
  try {
    if (language === 'json') JSON.parse(code);
    // Add more language validations as needed
    return true;
  } catch {
    return false;
  }
}