import { describe, it, expect as vitestExpect } from "vitest";
import {
  containsAllRequiredFields,
  containsJSON,
  containsKeywords,
  expect,
  followsInstructions,
  hasLength,
  hasNoHallucinations,
  hasNoToxicity,
  hasSentiment,
  hasValidCodeSyntax,
  isValidEmail,
  isValidURL,
  matchesPattern,
  matchesSchema,
  notContainsPII,
  runAssertions,
  similarTo,
  withinRange,
} from "../assertions";

describe("Expectation fluent API", () => {
  describe("toEqual", () => {
    it("should pass when values are equal", () => {
      const result = expect("hello").toEqual("hello");
      vitestExpect(result.passed).toBe(true);
      vitestExpect(result.name).toBe("toEqual");
    });

    it("should fail when values differ", () => {
      const result = expect("hello").toEqual("world");
      vitestExpect(result.passed).toBe(false);
    });

    it("should handle objects", () => {
      const result = expect({ a: 1 }).toEqual({ a: 1 });
      vitestExpect(result.passed).toBe(true);
    });
  });

  describe("toContain", () => {
    it("should pass when substring is found", () => {
      const result = expect("Hello, world!").toContain("world");
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when substring is missing", () => {
      const result = expect("Hello, world!").toContain("foo");
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toContainKeywords", () => {
    it("should pass when all keywords are present (case insensitive)", () => {
      const result = expect("The quick Brown fox").toContainKeywords(["quick", "brown"]);
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when keywords are missing", () => {
      const result = expect("The quick fox").toContainKeywords(["quick", "brown"]);
      vitestExpect(result.passed).toBe(false);
      vitestExpect(result.message).toContain("brown");
    });
  });

  describe("toNotContain", () => {
    it("should pass when substring is absent", () => {
      const result = expect("safe text").toNotContain("danger");
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when substring is present", () => {
      const result = expect("some danger ahead").toNotContain("danger");
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toNotContainPII", () => {
    it("should pass with no PII", () => {
      const result = expect("Just a normal sentence").toNotContainPII();
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail with an email", () => {
      const result = expect("Contact me at user@example.com").toNotContainPII();
      vitestExpect(result.passed).toBe(false);
    });

    it("should fail with a phone number", () => {
      const result = expect("Call 555-123-4567").toNotContainPII();
      vitestExpect(result.passed).toBe(false);
    });

    it("should fail with an SSN", () => {
      const result = expect("SSN is 123-45-6789").toNotContainPII();
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toMatchPattern", () => {
    it("should pass when pattern matches", () => {
      const result = expect("Order #12345").toMatchPattern(/Order #\d+/);
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when pattern does not match", () => {
      const result = expect("No order here").toMatchPattern(/Order #\d+/);
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toBeValidJSON", () => {
    it("should pass for valid JSON", () => {
      const result = expect('{"key": "value"}').toBeValidJSON();
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail for invalid JSON", () => {
      const result = expect("not json").toBeValidJSON();
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toMatchJSON", () => {
    it("should pass when all schema keys exist", () => {
      const result = expect('{"status":"ok","data":1}').toMatchJSON({ status: "", data: "" });
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when schema keys are missing", () => {
      const result = expect('{"status":"ok"}').toMatchJSON({ status: "", missing: "" });
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toHaveSentiment", () => {
    it("should detect positive sentiment", () => {
      const result = expect("This is great and amazing!").toHaveSentiment("positive");
      vitestExpect(result.passed).toBe(true);
    });

    it("should detect negative sentiment", () => {
      const result = expect("This is terrible and awful").toHaveSentiment("negative");
      vitestExpect(result.passed).toBe(true);
    });

    it("should detect neutral sentiment", () => {
      const result = expect("The sky is blue").toHaveSentiment("neutral");
      vitestExpect(result.passed).toBe(true);
    });
  });

  describe("toHaveLength", () => {
    it("should pass when within range", () => {
      const result = expect("hello").toHaveLength({ min: 3, max: 10 });
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when too short", () => {
      const result = expect("hi").toHaveLength({ min: 5 });
      vitestExpect(result.passed).toBe(false);
    });

    it("should fail when too long", () => {
      const result = expect("a very long string").toHaveLength({ max: 5 });
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toNotHallucinate", () => {
    it("should pass when all facts are present", () => {
      const result = expect("Paris is the capital of France").toNotHallucinate(["paris", "france"]);
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when facts are missing", () => {
      const result = expect("Berlin is great").toNotHallucinate(["paris", "france"]);
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toBeFasterThan", () => {
    it("should pass when value is under threshold", () => {
      const result = expect(500).toBeFasterThan(1000);
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail when value exceeds threshold", () => {
      const result = expect(1500).toBeFasterThan(1000);
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toBeTruthy / toBeFalsy", () => {
    it("should pass for truthy values", () => {
      vitestExpect(expect("hello").toBeTruthy().passed).toBe(true);
      vitestExpect(expect(1).toBeTruthy().passed).toBe(true);
    });

    it("should pass for falsy values", () => {
      vitestExpect(expect("").toBeFalsy().passed).toBe(true);
      vitestExpect(expect(0).toBeFalsy().passed).toBe(true);
    });
  });

  describe("toBeGreaterThan / toBeLessThan / toBeBetween", () => {
    it("should work for greater than", () => {
      vitestExpect(expect(10).toBeGreaterThan(5).passed).toBe(true);
      vitestExpect(expect(3).toBeGreaterThan(5).passed).toBe(false);
    });

    it("should work for less than", () => {
      vitestExpect(expect(3).toBeLessThan(5).passed).toBe(true);
      vitestExpect(expect(10).toBeLessThan(5).passed).toBe(false);
    });

    it("should work for between", () => {
      vitestExpect(expect(5).toBeBetween(1, 10).passed).toBe(true);
      vitestExpect(expect(15).toBeBetween(1, 10).passed).toBe(false);
    });
  });

  describe("toContainCode", () => {
    it("should detect code blocks", () => {
      const result = expect('Here is code:\n```js\nconsole.log("hi")\n```').toContainCode();
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail without code blocks", () => {
      const result = expect("No code here").toContainCode();
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toBeProfessional", () => {
    it("should pass for professional text", () => {
      const result = expect("Thank you for your inquiry.").toBeProfessional();
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail for unprofessional text", () => {
      const result = expect("This is damn stupid").toBeProfessional();
      vitestExpect(result.passed).toBe(false);
    });
  });

  describe("toHaveProperGrammar", () => {
    it("should pass for properly formatted text", () => {
      const result = expect("This is a sentence.").toHaveProperGrammar();
      vitestExpect(result.passed).toBe(true);
    });

    it("should fail for double spaces", () => {
      const result = expect("This  has double spaces.").toHaveProperGrammar();
      vitestExpect(result.passed).toBe(false);
    });
  });
});

describe("runAssertions", () => {
  it("should collect all results", () => {
    const results = runAssertions([
      () => expect("hello").toContain("hello"),
      () => expect("hello").toContain("missing"),
    ]);
    vitestExpect(results).toHaveLength(2);
    vitestExpect(results[0].passed).toBe(true);
    vitestExpect(results[1].passed).toBe(false);
  });

  it("should catch thrown errors", () => {
    const results = runAssertions([
      () => {
        throw new Error("boom");
      },
    ]);
    vitestExpect(results[0].passed).toBe(false);
    vitestExpect(results[0].message).toBe("boom");
  });
});

describe("Standalone assertion functions", () => {
  it("containsKeywords", () => {
    vitestExpect(containsKeywords("The quick brown fox", ["quick", "brown"])).toBe(true);
    vitestExpect(containsKeywords("The quick fox", ["quick", "brown"])).toBe(false);
  });

  it("matchesPattern", () => {
    vitestExpect(matchesPattern("abc123", /\d+/)).toBe(true);
    vitestExpect(matchesPattern("abc", /\d+/)).toBe(false);
  });

  it("hasLength", () => {
    vitestExpect(hasLength("hello", { min: 3, max: 10 })).toBe(true);
    vitestExpect(hasLength("hi", { min: 5 })).toBe(false);
  });

  it("containsJSON", () => {
    vitestExpect(containsJSON('{"a":1}')).toBe(true);
    vitestExpect(containsJSON("not json")).toBe(false);
  });

  it("notContainsPII", () => {
    vitestExpect(notContainsPII("Just a normal text")).toBe(true);
    vitestExpect(notContainsPII("Email: user@example.com")).toBe(false);
  });

  it("hasSentiment", () => {
    vitestExpect(hasSentiment("This is great", "positive")).toBe(true);
    vitestExpect(hasSentiment("This is terrible", "negative")).toBe(true);
  });

  it("similarTo", () => {
    vitestExpect(similarTo("the quick brown fox", "the quick brown dog", 0.5)).toBe(true);
    vitestExpect(similarTo("hello world", "completely different", 0.8)).toBe(false);
  });

  it("withinRange", () => {
    vitestExpect(withinRange(5, 1, 10)).toBe(true);
    vitestExpect(withinRange(15, 1, 10)).toBe(false);
  });

  it("isValidEmail", () => {
    vitestExpect(isValidEmail("user@example.com")).toBe(true);
    vitestExpect(isValidEmail("not-an-email")).toBe(false);
  });

  it("isValidURL", () => {
    vitestExpect(isValidURL("https://example.com")).toBe(true);
    vitestExpect(isValidURL("not a url")).toBe(false);
  });

  it("hasNoHallucinations", () => {
    vitestExpect(hasNoHallucinations("Paris is in France", ["Paris", "France"])).toBe(true);
    vitestExpect(hasNoHallucinations("Berlin is great", ["Paris"])).toBe(false);
  });

  it("matchesSchema", () => {
    vitestExpect(matchesSchema({ name: "test", value: 1 }, { name: "", value: "" })).toBe(true);
    vitestExpect(matchesSchema({ name: "test" }, { name: "", missing: "" })).toBe(false);
    vitestExpect(matchesSchema("not an object", { key: "" })).toBe(false);
  });

  it("hasNoToxicity", () => {
    vitestExpect(hasNoToxicity("Have a nice day")).toBe(true);
    vitestExpect(hasNoToxicity("You are an idiot")).toBe(false);
  });

  it("followsInstructions", () => {
    vitestExpect(followsInstructions("Hello world", ["Hello"])).toBe(true);
    vitestExpect(followsInstructions("Hello world", ["!goodbye"])).toBe(true);
    vitestExpect(followsInstructions("Hello world", ["missing"])).toBe(false);
  });

  it("containsAllRequiredFields", () => {
    vitestExpect(containsAllRequiredFields({ a: 1, b: 2 }, ["a", "b"])).toBe(true);
    vitestExpect(containsAllRequiredFields({ a: 1 }, ["a", "b"])).toBe(false);
  });

  it("hasValidCodeSyntax", () => {
    vitestExpect(hasValidCodeSyntax('{"valid": true}', "json")).toBe(true);
    vitestExpect(hasValidCodeSyntax("{invalid}", "json")).toBe(false);
  });
});
