import {
	afterEach,
	beforeEach,
	describe,
	it,
	vi,
	expect as vitestExpect,
} from "vitest";
import {
	type AssertionLLMConfig,
	configureAssertions,
	containsAllRequiredFields,
	containsJSON,
	containsKeywords,
	containsLanguage,
	containsLanguageAsync,
	expect,
	followsInstructions,
	getAssertionConfig,
	hasConsistency,
	hasConsistencyAsync,
	hasFactualAccuracy,
	hasFactualAccuracyAsync,
	hasLength,
	hasNoHallucinations,
	hasNoHallucinationsAsync,
	hasNoToxicity,
	hasNoToxicityAsync,
	hasReadabilityScore,
	hasSentiment,
	hasSentimentAsync,
	hasSentimentWithScore,
	hasValidCodeSyntax,
	hasValidCodeSyntaxAsync,
	isValidEmail,
	isValidURL,
	matchesPattern,
	matchesSchema,
	notContainsPII,
	resetSentimentDeprecationWarning,
	runAssertions,
	similarTo,
	toSemanticallyContain,
	toSemanticallyContainLLM,
	withinRange,
} from "../assertions";
import { createLocalExecutor, defaultLocalExecutor } from "../runtime/executor";

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
			const result = expect("The quick Brown fox").toContainKeywords([
				"quick",
				"brown",
			]);
			vitestExpect(result.passed).toBe(true);
		});

		it("should fail when keywords are missing", () => {
			const result = expect("The quick fox").toContainKeywords([
				"quick",
				"brown",
			]);
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
		it("should pass when schema values match", () => {
			const result = expect('{"status":"ok","data":1}').toMatchJSON({
				status: "ok",
				data: 1,
			});
			vitestExpect(result.passed).toBe(true);
		});

		it("should fail when schema values differ", () => {
			const result = expect('{"status":"ok"}').toMatchJSON({
				status: "error",
			});
			vitestExpect(result.passed).toBe(false);
		});

		it("should fail when schema keys are missing", () => {
			const result = expect('{"status":"ok"}').toMatchJSON({
				status: "ok",
				missing: "something",
			});
			vitestExpect(result.passed).toBe(false);
		});
	});

	describe("toHaveSentiment", () => {
		it("should detect positive sentiment", () => {
			const result = expect("This is great and amazing!").toHaveSentiment(
				"positive",
			);
			vitestExpect(result.passed).toBe(true);
		});

		it("should detect negative sentiment", () => {
			const result = expect("This is terrible and awful").toHaveSentiment(
				"negative",
			);
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
			const result = expect("Paris is the capital of France").toNotHallucinate([
				"paris",
				"france",
			]);
			vitestExpect(result.passed).toBe(true);
		});

		it("should fail when facts are missing", () => {
			const result = expect("Berlin is great").toNotHallucinate([
				"paris",
				"france",
			]);
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
			const result = expect(
				'Here is code:\n```js\nconsole.log("hi")\n```',
			).toContainCode();
			vitestExpect(result.passed).toBe(true);
		});

		it("should fail without code blocks", () => {
			const result = expect("No code here").toContainCode();
			vitestExpect(result.passed).toBe(false);
		});

		it("should detect raw function declaration (bug fix)", () => {
			const result = expect(
				"function calculateTotal(items) { return items.reduce((a, b) => a + b, 0); }",
			).toContainCode();
			vitestExpect(result.passed).toBe(true);
		});

		it("should detect raw const assignment (bug fix)", () => {
			const result = expect("const result = fetchData();").toContainCode();
			vitestExpect(result.passed).toBe(true);
		});

		it("should detect raw import statement (bug fix)", () => {
			const result = expect(
				"import { useState } from 'react';",
			).toContainCode();
			vitestExpect(result.passed).toBe(true);
		});

		it("should still reject plain prose", () => {
			const result = expect(
				"The weather is nice today and I went for a walk.",
			).toContainCode();
			vitestExpect(result.passed).toBe(false);
		});
	});

	describe("toHaveNoProfanity", () => {
		it("should pass for clean text", () => {
			const result = expect("Thank you for your inquiry.").toHaveNoProfanity();
			vitestExpect(result.passed).toBe(true);
		});

		it("should fail for profane text", () => {
			const result = expect("This is damn stupid").toHaveNoProfanity();
			vitestExpect(result.passed).toBe(false);
		});

		it("should NOT false-positive on 'hello' (contains 'hell' substring)", () => {
			const result = expect("Hello, how can I help you?").toHaveNoProfanity();
			vitestExpect(result.passed).toBe(true);
		});

		it("should NOT false-positive on 'shell', 'shellfish', 'assess'", () => {
			vitestExpect(
				expect("The shell command failed").toHaveNoProfanity().passed,
			).toBe(true);
			vitestExpect(expect("I love shellfish").toHaveNoProfanity().passed).toBe(
				true,
			);
			vitestExpect(
				expect("Let me assess the situation").toHaveNoProfanity().passed,
			).toBe(true);
		});

		it("should still catch actual profanity as whole words", () => {
			vitestExpect(
				expect("What the hell is this").toHaveNoProfanity().passed,
			).toBe(false);
			vitestExpect(expect("You are an ass").toHaveNoProfanity().passed).toBe(
				false,
			);
		});
	});

	describe("toBeProfessional (deprecated alias)", () => {
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
		vitestExpect(
			containsKeywords("The quick brown fox", ["quick", "brown"]),
		).toBe(true);
		vitestExpect(containsKeywords("The quick fox", ["quick", "brown"])).toBe(
			false,
		);
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
		vitestExpect(
			similarTo("the quick brown fox", "the quick brown dog", 0.5),
		).toBe(true);
		vitestExpect(similarTo("hello world", "completely different", 0.8)).toBe(
			false,
		);
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
		vitestExpect(
			hasNoHallucinations("Paris is in France", ["Paris", "France"]),
		).toBe(true);
		vitestExpect(hasNoHallucinations("Berlin is great", ["Paris"])).toBe(false);
	});

	it("matchesSchema", () => {
		vitestExpect(
			matchesSchema({ name: "test", value: 1 }, { name: "", value: "" }),
		).toBe(true);
		vitestExpect(
			matchesSchema({ name: "test" }, { name: "", missing: "" }),
		).toBe(false);
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
		vitestExpect(containsAllRequiredFields({ a: 1, b: 2 }, ["a", "b"])).toBe(
			true,
		);
		vitestExpect(containsAllRequiredFields({ a: 1 }, ["a", "b"])).toBe(false);
	});

	it("hasValidCodeSyntax", () => {
		vitestExpect(hasValidCodeSyntax('{"valid": true}', "json")).toBe(true);
		vitestExpect(hasValidCodeSyntax("{invalid}", "json")).toBe(false);
	});
});

describe("hasSentiment — expanded lexicon and substring matching", () => {
	it("detects positive via substring (not exact word boundary)", () => {
		vitestExpect(
			hasSentiment("magnificent performance overall", "positive"),
		).toBe(true);
		vitestExpect(hasSentiment("truly inspiring work", "positive")).toBe(true);
		vitestExpect(
			hasSentiment("an outstanding and valuable result", "positive"),
		).toBe(true);
	});

	it("detects negative via substring", () => {
		vitestExpect(
			hasSentiment("utterly mediocre and flawed output", "negative"),
		).toBe(true);
		vitestExpect(
			hasSentiment("completely unreliable and disappointing", "negative"),
		).toBe(true);
	});

	it("returns false when sentiment does not match", () => {
		vitestExpect(hasSentiment("This is great and amazing!", "negative")).toBe(
			false,
		);
		vitestExpect(hasSentiment("This is terrible and awful", "positive")).toBe(
			false,
		);
	});

	it("neutral when positive and negative counts are equal", () => {
		vitestExpect(hasSentiment("The sky is blue", "neutral")).toBe(true);
	});
});

describe("hasNoHallucinations — case-insensitive", () => {
	it("matches facts regardless of case in text", () => {
		vitestExpect(
			hasNoHallucinations("PARIS is the capital of FRANCE", [
				"paris",
				"france",
			]),
		).toBe(true);
	});

	it("matches facts regardless of case in fact list", () => {
		vitestExpect(
			hasNoHallucinations("Paris is the capital of France", [
				"PARIS",
				"FRANCE",
			]),
		).toBe(true);
	});

	it("returns false when a fact is absent", () => {
		vitestExpect(hasNoHallucinations("Berlin is great", ["paris"])).toBe(false);
	});
});

describe("hasFactualAccuracy — case-insensitive", () => {
	it("passes when facts appear in different case", () => {
		vitestExpect(
			hasFactualAccuracy("The Eiffel Tower is in Paris", [
				"eiffel tower",
				"paris",
			]),
		).toBe(true);
	});

	it("passes when fact list uses different case than text", () => {
		vitestExpect(
			hasFactualAccuracy("albert einstein was a physicist", [
				"Albert Einstein",
			]),
		).toBe(true);
	});

	it("returns false when a fact is missing", () => {
		vitestExpect(
			hasFactualAccuracy("The Eiffel Tower is in Paris", ["london"]),
		).toBe(false);
	});
});

describe("matchesSchema — JSON Schema formats", () => {
	it("handles JSON Schema required array — keys exist", () => {
		vitestExpect(
			matchesSchema(
				{ name: "test", score: 95 },
				{ type: "object", required: ["name", "score"] },
			),
		).toBe(true);
	});

	it("handles JSON Schema required array — missing required key", () => {
		vitestExpect(
			matchesSchema(
				{ name: "test" },
				{ type: "object", required: ["name", "score"] },
			),
		).toBe(false);
	});

	it("handles JSON Schema required — reported regression case", () => {
		vitestExpect(
			matchesSchema(
				{ name: "test", score: 95 },
				{ type: "object", required: ["name"] },
			),
		).toBe(true);
	});

	it("handles JSON Schema properties format", () => {
		vitestExpect(
			matchesSchema(
				{ name: "alice", age: 30 },
				{ properties: { name: {}, age: {} } },
			),
		).toBe(true);
		vitestExpect(
			matchesSchema({ name: "alice" }, { properties: { name: {}, age: {} } }),
		).toBe(false);
	});

	it("preserves backward-compatible simple template format", () => {
		vitestExpect(
			matchesSchema({ name: "test", value: 1 }, { name: "", value: "" }),
		).toBe(true);
		vitestExpect(
			matchesSchema({ name: "test" }, { name: "", missing: "" }),
		).toBe(false);
	});

	it("returns false for non-objects", () => {
		vitestExpect(matchesSchema("not an object", { key: "" })).toBe(false);
		vitestExpect(matchesSchema(null, { key: "" })).toBe(false);
	});
});

describe("hasNoToxicity — expanded categories", () => {
	it("passes for clean text", () => {
		vitestExpect(hasNoToxicity("Have a great day!")).toBe(true);
		vitestExpect(hasNoToxicity("The report is ready for review.")).toBe(true);
	});

	it("catches direct insults", () => {
		vitestExpect(hasNoToxicity("You are an idiot")).toBe(false);
		vitestExpect(hasNoToxicity("What a complete moron")).toBe(false);
		vitestExpect(hasNoToxicity("You're a dumbass")).toBe(false);
	});

	it("catches violence and threats", () => {
		vitestExpect(hasNoToxicity("I will kill you")).toBe(false);
		vitestExpect(hasNoToxicity("I'll destroy you")).toBe(false);
		vitestExpect(hasNoToxicity("hope you die")).toBe(false);
	});

	it("catches self-harm directed at others", () => {
		vitestExpect(hasNoToxicity("go kill yourself")).toBe(false);
		vitestExpect(hasNoToxicity("better off dead")).toBe(false);
	});

	it("catches profanity used as attacks", () => {
		vitestExpect(hasNoToxicity("fuck you and your team")).toBe(false);
		vitestExpect(hasNoToxicity("shut the fuck up")).toBe(false);
	});

	it("catches harassment", () => {
		vitestExpect(hasNoToxicity("i'll ruin you")).toBe(false);
		vitestExpect(hasNoToxicity("make your life hell")).toBe(false);
	});
});

describe("hasValidCodeSyntax — real bracket balance", () => {
	describe("JSON", () => {
		it("passes for valid JSON", () => {
			vitestExpect(hasValidCodeSyntax('{"valid": true}', "json")).toBe(true);
		});
		it("fails for invalid JSON", () => {
			vitestExpect(hasValidCodeSyntax("{invalid}", "json")).toBe(false);
		});
	});

	describe("JavaScript/TypeScript", () => {
		it("passes for valid function", () => {
			vitestExpect(
				hasValidCodeSyntax("function add(a, b) { return a + b; }", "js"),
			).toBe(true);
			vitestExpect(
				hasValidCodeSyntax(
					"const fn = (x: number): number => { return x * 2; }",
					"ts",
				),
			).toBe(true);
		});

		it("fails for unclosed brace", () => {
			vitestExpect(
				hasValidCodeSyntax("function add(a, b) { return a + b;", "js"),
			).toBe(false);
		});

		it("fails for unclosed parenthesis", () => {
			vitestExpect(hasValidCodeSyntax("console.log('hello'", "js")).toBe(false);
		});

		it("fails for extra closing delimiter", () => {
			vitestExpect(
				hasValidCodeSyntax("function foo() {} }", "javascript"),
			).toBe(false);
		});

		it("ignores braces inside template literals", () => {
			vitestExpect(
				// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional — testing that ${} inside backtick strings is ignored
				hasValidCodeSyntax("const msg = `Hello ${name}`;", "ts"),
			).toBe(true);
		});

		it("ignores braces inside line comments", () => {
			vitestExpect(
				hasValidCodeSyntax(
					"// { unclosed comment brace\nfunction foo() {}",
					"js",
				),
			).toBe(true);
		});

		it("ignores braces inside block comments", () => {
			vitestExpect(
				hasValidCodeSyntax("/* { unclosed */ function foo() {}", "typescript"),
			).toBe(true);
		});

		it("ignores braces inside string literals", () => {
			vitestExpect(hasValidCodeSyntax('const s = "hello {world}";', "js")).toBe(
				true,
			);
		});
	});

	describe("Python", () => {
		it("passes for valid function", () => {
			vitestExpect(
				hasValidCodeSyntax("def add(a, b):\n    return a + b", "python"),
			).toBe(true);
		});

		it("fails for unclosed parenthesis", () => {
			vitestExpect(hasValidCodeSyntax("def foo(a, b:\n    pass", "py")).toBe(
				false,
			);
		});

		it("ignores braces after hash comment", () => {
			vitestExpect(
				hasValidCodeSyntax("# { unclosed\ndef foo():\n    pass", "python"),
			).toBe(true);
		});
	});
});

describe("containsLanguage — 12 languages", () => {
	it("detects English", () => {
		vitestExpect(
			containsLanguage("The quick brown fox jumps over the lazy dog", "en"),
		).toBe(true);
	});

	it("detects French", () => {
		vitestExpect(
			containsLanguage("Le renard brun saute par-dessus le chien", "fr"),
		).toBe(true);
	});

	it("detects German", () => {
		vitestExpect(
			containsLanguage("Der schnelle braune Fuchs springt über den Hund", "de"),
		).toBe(true);
	});

	it("detects Spanish", () => {
		vitestExpect(
			containsLanguage("El zorro marrón salta sobre el perro", "es"),
		).toBe(true);
	});

	it("detects Chinese via CJK characters", () => {
		vitestExpect(containsLanguage("这是一个测试的句子", "zh")).toBe(true);
	});

	it("detects Japanese via hiragana markers", () => {
		vitestExpect(containsLanguage("これはテストの文です", "ja")).toBe(true);
	});

	it("handles BCP-47 subtag (zh-CN → zh)", () => {
		vitestExpect(containsLanguage("这是中文", "zh-CN")).toBe(true);
	});

	it("returns false for unknown language code", () => {
		vitestExpect(containsLanguage("Hello world", "xx")).toBe(false);
	});
});

describe("Async LLM assertions", () => {
	const savedConfig: AssertionLLMConfig | null = getAssertionConfig();

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		if (savedConfig) configureAssertions(savedConfig);
	});

	const mockOpenAI = (content: string) => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ choices: [{ message: { content } }] }),
			text: async () => content,
		});
	};

	const mockAnthropic = (text: string) => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ content: [{ text }] }),
			text: async () => text,
		});
	};

	const openaiCfg: AssertionLLMConfig = {
		provider: "openai",
		apiKey: "sk-test",
	};
	const anthropicCfg: AssertionLLMConfig = {
		provider: "anthropic",
		apiKey: "sk-ant-test",
	};

	it("configureAssertions sets global config used by async functions", async () => {
		configureAssertions(openaiCfg);
		mockOpenAI('{"sentiment":"positive","confidence":0.92}');
		const result = await hasSentimentAsync("I love this!", "positive");
		vitestExpect(result.matches).toBe(true);
		vitestExpect(result.sentiment).toBe("positive");
		vitestExpect(result.confidence).toBe(0.92);
		vitestExpect(fetch).toHaveBeenCalledOnce();
	});

	it("hasSentimentAsync — OpenAI — positive match with confidence", async () => {
		mockOpenAI('{"sentiment":"positive","confidence":0.95}');
		const result = await hasSentimentAsync(
			"I love this!",
			"positive",
			openaiCfg,
		);
		vitestExpect(result.matches).toBe(true);
		vitestExpect(result.sentiment).toBe("positive");
		vitestExpect(result.confidence).toBe(0.95);
	});

	it("hasSentimentAsync — OpenAI — mismatch returns matches=false", async () => {
		mockOpenAI('{"sentiment":"negative","confidence":0.8}');
		const result = await hasSentimentAsync(
			"I love this!",
			"positive",
			openaiCfg,
		);
		vitestExpect(result.matches).toBe(false);
		vitestExpect(result.sentiment).toBe("negative");
		vitestExpect(result.confidence).toBe(0.8);
	});

	it("hasSentimentAsync — Anthropic path with confidence", async () => {
		mockAnthropic('{"sentiment":"neutral","confidence":0.75}');
		const result = await hasSentimentAsync(
			"The sky is blue.",
			"neutral",
			anthropicCfg,
		);
		vitestExpect(result.matches).toBe(true);
		vitestExpect(result.sentiment).toBe("neutral");
		vitestExpect(result.confidence).toBe(0.75);
	});

	it("hasSentimentAsync — falls back gracefully for single-word response", async () => {
		mockOpenAI("positive");
		const result = await hasSentimentAsync(
			"I love this!",
			"positive",
			openaiCfg,
		);
		vitestExpect(result.matches).toBe(true);
		vitestExpect(result.sentiment).toBe("positive");
		vitestExpect(result.confidence).toBe(0.5); // fallback confidence
	});

	it("hasSentimentAsync — Symbol.toPrimitive coerces to matches (true case)", async () => {
		mockOpenAI('{"sentiment":"positive","confidence":0.9}');
		const result = await hasSentimentAsync(
			"I love this!",
			"positive",
			openaiCfg,
		);
		// Legacy boolean coercion via Symbol.toPrimitive — should return matches (true)
		vitestExpect(+result).toBe(1); // number coercion
		vitestExpect(`${result}`).toContain("matches=true"); // string coercion
	});

	it("hasSentimentAsync — Symbol.toPrimitive coerces to matches (false case)", async () => {
		mockOpenAI('{"sentiment":"negative","confidence":0.8}');
		const result = await hasSentimentAsync(
			"I hate this!",
			"positive",
			openaiCfg,
		);
		// Legacy boolean coercion — should return matches (false)
		vitestExpect(+result).toBe(0); // number coercion
		vitestExpect(`${result}`).toContain("matches=false"); // string coercion
	});

	it("hasSentimentAsync — deprecation warning fires on coercion", async () => {
		resetSentimentDeprecationWarning();
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		mockOpenAI('{"sentiment":"positive","confidence":0.9}');
		const result = await hasSentimentAsync("Great!", "positive", openaiCfg);
		// Trigger coercion
		void +result;
		vitestExpect(warnSpy).toHaveBeenCalledWith(
			vitestExpect.stringContaining("DEPRECATION"),
		);
		warnSpy.mockRestore();
	});

	it("hasNoToxicityAsync — returns true when LLM says no", async () => {
		mockOpenAI("no");
		vitestExpect(await hasNoToxicityAsync("Have a great day!", openaiCfg)).toBe(
			true,
		);
	});

	it("hasNoToxicityAsync — returns false when LLM says yes", async () => {
		mockOpenAI("yes");
		vitestExpect(await hasNoToxicityAsync("I hate you", openaiCfg)).toBe(false);
	});

	it("containsLanguageAsync — detects language via LLM", async () => {
		mockOpenAI("yes");
		vitestExpect(
			await containsLanguageAsync("Bonjour le monde", "French", openaiCfg),
		).toBe(true);
	});

	it("hasValidCodeSyntaxAsync — valid code", async () => {
		mockAnthropic("yes");
		vitestExpect(
			await hasValidCodeSyntaxAsync("def foo(): pass", "python", anthropicCfg),
		).toBe(true);
	});

	it("hasValidCodeSyntaxAsync — invalid code", async () => {
		mockOpenAI("no");
		vitestExpect(
			await hasValidCodeSyntaxAsync("def foo(: pass", "python", openaiCfg),
		).toBe(false);
	});

	it("hasFactualAccuracyAsync — all facts present", async () => {
		mockOpenAI("yes");
		vitestExpect(
			await hasFactualAccuracyAsync(
				"Paris is in France",
				["Paris is in France"],
				openaiCfg,
			),
		).toBe(true);
	});

	it("hasNoHallucinationsAsync — consistent with ground truth", async () => {
		mockAnthropic("yes");
		vitestExpect(
			await hasNoHallucinationsAsync(
				"The sun orbits the Earth",
				["The Earth orbits the sun"],
				anthropicCfg,
			),
		).toBe(true);
	});

	it("throws a clear error when no config is set", async () => {
		configureAssertions(null as unknown as AssertionLLMConfig);
		await vitestExpect(hasSentimentAsync("test", "positive")).rejects.toThrow(
			"No LLM config set",
		);
	});

	it("throws on unsupported provider", async () => {
		const badCfg = {
			provider: "gemini",
			apiKey: "key",
		} as unknown as AssertionLLMConfig;
		await vitestExpect(
			hasSentimentAsync("test", "positive", badCfg),
		).rejects.toThrow("Unsupported provider");
	});

	it("throws on non-ok API response", async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});
		await vitestExpect(
			hasSentimentAsync("test", "positive", openaiCfg),
		).rejects.toThrow("OpenAI API error 401");
	});

	it("times out when LLM call exceeds timeoutMs", async () => {
		(fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
			() => new Promise((resolve) => setTimeout(resolve, 5000)),
		);
		const fastTimeoutCfg = { ...openaiCfg, timeoutMs: 50 };
		await vitestExpect(
			hasSentimentAsync("test", "positive", fastTimeoutCfg),
		).rejects.toThrow("timed out after 50ms");
	});

	it("does NOT time out when LLM responds before deadline", async () => {
		mockOpenAI('{"sentiment":"positive","confidence":0.9}');
		const result = await hasSentimentAsync("Great!", "positive", {
			...openaiCfg,
			timeoutMs: 5000,
		});
		vitestExpect(result.matches).toBe(true);
		vitestExpect(result.sentiment).toBe("positive");
	});

	it("uses default 30s timeout when timeoutMs is not set", async () => {
		// Verify the config type accepts timeoutMs as optional
		const cfgWithoutTimeout: AssertionLLMConfig = {
			provider: "openai",
			apiKey: "test-key",
		};
		vitestExpect(cfgWithoutTimeout.timeoutMs).toBeUndefined();
	});
});

describe("hasReadabilityScore — {min} object form (bug fix)", () => {
	const readable = "The cat sat on the mat. Dogs run fast. Birds fly high.";

	it("should accept a plain number threshold", () => {
		vitestExpect(hasReadabilityScore(readable, 0)).toBe(true);
		vitestExpect(hasReadabilityScore(readable, 200)).toBe(false);
	});

	it("should accept { min } object form and not crash", () => {
		vitestExpect(() => hasReadabilityScore(readable, { min: 0 })).not.toThrow();
	});

	it("should pass when score is above { min }", () => {
		vitestExpect(hasReadabilityScore(readable, { min: 0 })).toBe(true);
	});

	it("should fail when score is below { min }", () => {
		vitestExpect(hasReadabilityScore(readable, { min: 200 })).toBe(false);
	});

	it("should apply { max } upper bound", () => {
		vitestExpect(hasReadabilityScore(readable, { min: 0, max: 200 })).toBe(
			true,
		);
		vitestExpect(hasReadabilityScore(readable, { min: 0, max: 1 })).toBe(false);
	});

	it("should treat missing min as 0 when only max provided", () => {
		vitestExpect(hasReadabilityScore(readable, { max: 200 })).toBe(true);
	});
});

describe("hasConsistency — pairwise Jaccard consistency scoring", () => {
	it("returns score 1 for single output (trivially consistent)", () => {
		const result = hasConsistency(["only one"]);
		vitestExpect(result.score).toBe(1);
		vitestExpect(result.consistent).toBe(true);
	});

	it("returns score 1 for identical outputs", () => {
		const result = hasConsistency([
			"The capital of France is Paris.",
			"The capital of France is Paris.",
		]);
		vitestExpect(result.score).toBe(1);
		vitestExpect(result.consistent).toBe(true);
	});

	it("returns high score for outputs with significant word overlap", () => {
		const result = hasConsistency([
			"The application server crashed due to a memory leak in the cache layer",
			"The application server crashed because of a memory leak in the cache layer",
			"The server application crashed from a memory leak in the cache layer",
		]);
		vitestExpect(result.score).toBeGreaterThan(0.7);
		vitestExpect(result.consistent).toBe(true);
	});

	it("returns low score for contradictory outputs", () => {
		const result = hasConsistency([
			"The answer is yes, absolutely correct.",
			"No, that is completely wrong and false.",
		]);
		vitestExpect(result.score).toBeLessThan(0.3);
		vitestExpect(result.consistent).toBe(false);
	});

	it("respects custom threshold", () => {
		const outputs = [
			"The application server crashed due to a memory leak in the cache layer",
			"The application server crashed because of a memory leak in the cache layer",
		];
		const strict = hasConsistency(outputs, 0.99);
		const lenient = hasConsistency(outputs, 0.5);
		vitestExpect(strict.consistent).toBe(false);
		vitestExpect(lenient.consistent).toBe(true);
	});

	it("handles empty array", () => {
		const result = hasConsistency([]);
		vitestExpect(result.score).toBe(1);
	});
});

describe("hasConsistencyAsync — LLM-backed", () => {
	const openaiCfg: AssertionLLMConfig = {
		provider: "openai",
		apiKey: "test-key",
	};

	const originalFetch = globalThis.fetch;
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns score from LLM response", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "85" } }],
			}),
		});
		const result = await hasConsistencyAsync(
			["Output A", "Output B"],
			openaiCfg,
		);
		vitestExpect(result.score).toBeCloseTo(0.85, 2);
		vitestExpect(result.consistent).toBe(true);
	});

	it("returns score 1 for single output without LLM call", async () => {
		const result = await hasConsistencyAsync(["single"], openaiCfg);
		vitestExpect(result.score).toBe(1);
		vitestExpect(result.consistent).toBe(true);
	});
});

describe("hasSentimentWithScore — confidence scoring", () => {
	it("returns positive sentiment with high confidence for strongly positive text", () => {
		const result = hasSentimentWithScore(
			"This is absolutely amazing, wonderful, and fantastic!",
			"positive",
		);
		vitestExpect(result.sentiment).toBe("positive");
		vitestExpect(result.confidence).toBeGreaterThan(0.5);
		vitestExpect(result.matches).toBe(true);
	});

	it("returns negative sentiment with high confidence for strongly negative text", () => {
		const result = hasSentimentWithScore(
			"This is terrible, awful, and horrible",
			"negative",
		);
		vitestExpect(result.sentiment).toBe("negative");
		vitestExpect(result.confidence).toBeGreaterThan(0.5);
		vitestExpect(result.matches).toBe(true);
	});

	it("returns neutral with confidence 1 for text with no sentiment words", () => {
		const result = hasSentimentWithScore(
			"The sky is blue and water is wet",
			"neutral",
		);
		vitestExpect(result.sentiment).toBe("neutral");
		vitestExpect(result.confidence).toBe(1);
		vitestExpect(result.matches).toBe(true);
	});

	it("returns matches=false when detected sentiment differs from expected", () => {
		const result = hasSentimentWithScore(
			"This is terrible and awful",
			"positive",
		);
		vitestExpect(result.sentiment).toBe("negative");
		vitestExpect(result.matches).toBe(false);
	});

	it("returns confidence between 0 and 1", () => {
		const result = hasSentimentWithScore(
			"Good but also bad and terrible",
			"negative",
		);
		vitestExpect(result.confidence).toBeGreaterThanOrEqual(0);
		vitestExpect(result.confidence).toBeLessThanOrEqual(1);
	});
});

describe("toSemanticallyContain — embedding-based", () => {
	const openaiCfg: AssertionLLMConfig = {
		provider: "openai",
		apiKey: "test-key",
	};

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Helper: mock embedding response with two vectors
	const mockEmbeddings = (vec1: number[], vec2: number[]) => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: [
					{ embedding: vec1, index: 0 },
					{ embedding: vec2, index: 1 },
				],
			}),
			text: async () => "ok",
		});
	};

	it("returns contains=true and similarity when vectors are close", async () => {
		// Nearly identical vectors → high cosine similarity
		mockEmbeddings([1, 0, 0], [0.9, 0.1, 0]);
		const result = await toSemanticallyContain(
			"The city of lights is beautiful in spring",
			"Paris",
			openaiCfg,
		);
		vitestExpect(result.contains).toBe(true);
		vitestExpect(result.similarity).toBeGreaterThan(0.4);
		vitestExpect(typeof result.similarity).toBe("number");
	});

	it("returns contains=false when vectors are orthogonal", async () => {
		// Orthogonal vectors → cosine similarity = 0
		mockEmbeddings([1, 0, 0], [0, 1, 0]);
		const result = await toSemanticallyContain(
			"I had pizza for lunch",
			"Paris",
			openaiCfg,
		);
		vitestExpect(result.contains).toBe(false);
		vitestExpect(result.similarity).toBeCloseTo(0, 5);
	});

	it("respects custom threshold", async () => {
		// Moderate similarity ~0.71
		mockEmbeddings([1, 1, 0], [1, 0, 0]);
		const result = await toSemanticallyContain(
			"text",
			"phrase",
			openaiCfg,
			0.8, // higher threshold
		);
		vitestExpect(result.contains).toBe(false);
		vitestExpect(result.similarity).toBeGreaterThan(0);
	});

	it("calls the embeddings API, not chat completions", async () => {
		mockEmbeddings([1, 0], [0, 1]);
		await toSemanticallyContain("text", "phrase", openaiCfg);
		const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
		vitestExpect(callUrl).toContain("/v1/embeddings");
		vitestExpect(callUrl).not.toContain("/v1/chat/completions");
	});

	it("throws for non-OpenAI providers", async () => {
		const anthropicCfg: AssertionLLMConfig = {
			provider: "anthropic",
			apiKey: "test-key",
		};
		await vitestExpect(
			toSemanticallyContain("text", "phrase", anthropicCfg),
		).rejects.toThrow('requires provider "openai"');
	});
});

describe("toSemanticallyContainLLM — LLM-prompt fallback", () => {
	const openaiCfg: AssertionLLMConfig = {
		provider: "openai",
		apiKey: "test-key",
	};

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns true when LLM says yes", async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ choices: [{ message: { content: "yes" } }] }),
			text: async () => "yes",
		});
		const result = await toSemanticallyContainLLM(
			"The city of lights is beautiful in spring",
			"Paris",
			openaiCfg,
		);
		vitestExpect(result).toBe(true);
	});

	it("returns false when LLM says no", async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ choices: [{ message: { content: "no" } }] }),
			text: async () => "no",
		});
		const result = await toSemanticallyContainLLM(
			"I had pizza for lunch",
			"Paris",
			openaiCfg,
		);
		vitestExpect(result).toBe(false);
	});
});

describe("defaultLocalExecutor — callable factory (bug fix)", () => {
	it("should be a function not an instance", () => {
		vitestExpect(typeof defaultLocalExecutor).toBe("function");
	});

	it("should be the same reference as createLocalExecutor", () => {
		vitestExpect(defaultLocalExecutor).toBe(createLocalExecutor);
	});

	it("should produce a usable executor when called", () => {
		const executor = defaultLocalExecutor();
		vitestExpect(executor).toBeDefined();
		vitestExpect(typeof executor.executeSpec).toBe("function");
	});

	it("should produce a new instance on each call", () => {
		const a = defaultLocalExecutor();
		const b = defaultLocalExecutor();
		vitestExpect(a).not.toBe(b);
	});
});
