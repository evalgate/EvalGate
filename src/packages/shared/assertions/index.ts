// Assertion library for AI evaluation
// Based on Hamel Husain's evaluation methodology

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
  }
}

// Core assertion functions
export function assertEquals(actual: any, expected: any, message?: string): AssertionResult {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  return {
    name: "assertEquals",
    passed,
    expected,
    actual,
    message:
      message ||
      (passed
        ? "Values are equal"
        : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  };
}

export function assertContains(text: string, substring: string, message?: string): AssertionResult {
  const passed = text.includes(substring);
  return {
    name: "assertContains",
    passed,
    expected: substring,
    actual: text,
    message:
      message || (passed ? `Text contains "${substring}"` : `Text does not contain "${substring}"`),
  };
}

export function assertNotContains(
  text: string,
  substring: string,
  message?: string,
): AssertionResult {
  const passed = !text.includes(substring);
  return {
    name: "assertNotContains",
    passed,
    expected: `not containing "${substring}"`,
    actual: text,
    message:
      message || (passed ? `Text does not contain "${substring}"` : `Text contains "${substring}"`),
  };
}

export function assertMatches(text: string, pattern: RegExp, message?: string): AssertionResult {
  const passed = pattern.test(text);
  return {
    name: "assertMatches",
    passed,
    expected: pattern.toString(),
    actual: text,
    message:
      message ||
      (passed ? `Text matches pattern ${pattern}` : `Text does not match pattern ${pattern}`),
  };
}

export function assertLengthBetween(
  text: string,
  min: number,
  max: number,
  message?: string,
): AssertionResult {
  const length = text.length;
  const passed = length >= min && length <= max;
  return {
    name: "assertLengthBetween",
    passed,
    expected: `length between ${min} and ${max}`,
    actual: length,
    message:
      message ||
      (passed
        ? `Length ${length} is within range`
        : `Length ${length} is not between ${min} and ${max}`),
  };
}

export function assertSentiment(
  text: string,
  expectedSentiment: "positive" | "negative" | "neutral",
  message?: string,
): AssertionResult {
  // Simple sentiment analysis based on keywords
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
  ];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((word) => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter((word) => lowerText.includes(word)).length;

  let actualSentiment: "positive" | "negative" | "neutral";
  if (positiveCount > negativeCount) {
    actualSentiment = "positive";
  } else if (negativeCount > positiveCount) {
    actualSentiment = "negative";
  } else {
    actualSentiment = "neutral";
  }

  const passed = actualSentiment === expectedSentiment;
  return {
    name: "assertSentiment",
    passed,
    expected: expectedSentiment,
    actual: actualSentiment,
    message:
      message ||
      (passed
        ? `Sentiment is ${expectedSentiment}`
        : `Expected ${expectedSentiment} sentiment, got ${actualSentiment}`),
  };
}

export function assertJsonValid(text: string, message?: string): AssertionResult {
  let passed = false;
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(text);
    passed = true;
  } catch (_e) {
    passed = false;
  }

  return {
    name: "assertJsonValid",
    passed,
    expected: "valid JSON",
    actual: passed ? parsedJson : text,
    message: message || (passed ? "Text is valid JSON" : "Text is not valid JSON"),
  };
}

export function assertJsonSchema(
  text: string,
  schema: Record<string, any>,
  message?: string,
): AssertionResult {
  let passed = false;
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(text);

    // Simple schema validation - check if all required keys exist
    const requiredKeys = Object.keys(schema);
    const actualKeys = Object.keys(parsedJson);
    passed = requiredKeys.every((key) => actualKeys.includes(key));
  } catch (_e) {
    passed = false;
  }

  return {
    name: "assertJsonSchema",
    passed,
    expected: schema,
    actual: parsedJson,
    message: message || (passed ? "JSON matches schema" : "JSON does not match schema"),
  };
}

export function assertLatency(
  durationMs: number,
  maxMs: number,
  message?: string,
): AssertionResult {
  const passed = durationMs <= maxMs;
  return {
    name: "assertLatency",
    passed,
    expected: `<= ${maxMs}ms`,
    actual: `${durationMs}ms`,
    message:
      message ||
      (passed
        ? `Latency ${durationMs}ms is within limit`
        : `Latency ${durationMs}ms exceeds ${maxMs}ms`),
  };
}

export function assertNoHallucination(
  output: string,
  groundTruth: string[],
  message?: string,
): AssertionResult {
  // Check if output contains facts not in ground truth
  // This is a simplified version - in production, you'd use more sophisticated methods
  const outputLower = output.toLowerCase();
  const allFactsPresent = groundTruth.every((fact) => outputLower.includes(fact.toLowerCase()));

  return {
    name: "assertNoHallucination",
    passed: allFactsPresent,
    expected: "all facts from ground truth",
    actual: output,
    message:
      message ||
      (allFactsPresent ? "No hallucinations detected" : "Output may contain hallucinations"),
  };
}

// Composite assertion runner
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
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
