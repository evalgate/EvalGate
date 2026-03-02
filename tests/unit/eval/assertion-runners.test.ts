import { describe, expect, it } from "vitest";
import { runPiiAssertion } from "@/lib/eval/assertion-runners/pii";
import { runToxicityAssertion } from "@/lib/eval/assertion-runners/toxicity";
import { runJsonSchemaAssertion } from "@/lib/eval/assertion-runners/json-schema";

// ── runPiiAssertion ───────────────────────────────────────────────────────────

describe("runPiiAssertion", () => {
	it("passes (no PII) for clean text", () => {
		const r = runPiiAssertion("The capital of France is Paris.");
		expect(r.passed).toBe(true);
		expect(r.key).toBe("pii");
		expect(r.category).toBe("privacy");
		expect(r.details).toBeUndefined();
	});

	it("fails when email address is present", () => {
		const r = runPiiAssertion("Contact us at support@example.com for help.");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/email/);
	});

	it("fails when SSN is present", () => {
		const r = runPiiAssertion("SSN: 123-45-6789");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/ssn/);
	});

	it("fails when US phone number is present", () => {
		const r = runPiiAssertion("Call us at 555-123-4567 anytime.");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/phone/i);
	});

	it("fails when credit card number is present", () => {
		const r = runPiiAssertion("Card: 4111 1111 1111 1111");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/credit_card/);
	});

	it("fails when IP address is present", () => {
		const r = runPiiAssertion("Server IP: 192.168.1.1");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/ip_address/);
	});

	it("reports multiple PII types in details", () => {
		const r = runPiiAssertion("Email: user@example.com, SSN: 123-45-6789");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/email/);
		expect(r.details).toMatch(/ssn/);
	});

	it("passes for empty string", () => {
		const r = runPiiAssertion("");
		expect(r.passed).toBe(true);
	});
});

// ── runToxicityAssertion ──────────────────────────────────────────────────────

describe("runToxicityAssertion", () => {
	it("passes for clean, helpful text", () => {
		const r = runToxicityAssertion("Here is a step-by-step solution to your problem.");
		expect(r.passed).toBe(true);
		expect(r.key).toBe("toxicity");
		expect(r.category).toBe("safety");
		expect(r.details).toBeUndefined();
	});

	it("fails when toxic keyword is present", () => {
		const r = runToxicityAssertion("I hate you so much.");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/hate you/i);
	});

	it("is case-insensitive", () => {
		const r = runToxicityAssertion("You are WORTHLESS.");
		expect(r.passed).toBe(false);
	});

	it("passes for empty string", () => {
		const r = runToxicityAssertion("");
		expect(r.passed).toBe(true);
	});

	it("fails for multiple toxic phrases", () => {
		const r = runToxicityAssertion("You are worthless and stupid idiot.");
		expect(r.passed).toBe(false);
		expect(r.details).toContain("worthless");
	});

	it("details lists detected keywords", () => {
		const r = runToxicityAssertion("I hate you.");
		expect(r.details).toBeDefined();
		expect(r.details).toContain("hate you");
	});
});

// ── runJsonSchemaAssertion ────────────────────────────────────────────────────

describe("runJsonSchemaAssertion", () => {
	it("passes for valid JSON object", () => {
		const r = runJsonSchemaAssertion('{"name": "Alice", "age": 30}');
		expect(r.passed).toBe(true);
		expect(r.key).toBe("json_schema");
		expect(r.category).toBe("format");
	});

	it("fails for invalid JSON", () => {
		const r = runJsonSchemaAssertion("not json");
		expect(r.passed).toBe(false);
		expect(r.details).toMatch(/not valid JSON/i);
	});

	it("passes for JSON array (implementation treats arrays as valid objects)", () => {
		// typeof [] === "object" && [] !== null — the runner passes arrays
		const r = runJsonSchemaAssertion("[1, 2, 3]");
		expect(r.passed).toBe(true);
	});

	it("fails for JSON primitive (string)", () => {
		const r = runJsonSchemaAssertion('"hello"');
		expect(r.passed).toBe(false);
	});

	it("passes when all required keys are present", () => {
		const r = runJsonSchemaAssertion('{"name": "Alice", "score": 0.9}', {
			requiredKeys: ["name", "score"],
		});
		expect(r.passed).toBe(true);
		expect(r.details).toBeUndefined();
	});

	it("fails when required keys are missing", () => {
		const r = runJsonSchemaAssertion('{"name": "Alice"}', {
			requiredKeys: ["name", "score"],
		});
		expect(r.passed).toBe(false);
		expect(r.details).toContain("score");
	});

	it("passes with no requiredKeys option", () => {
		const r = runJsonSchemaAssertion('{"anything": "goes"}');
		expect(r.passed).toBe(true);
	});

	it("passes with empty requiredKeys array", () => {
		const r = runJsonSchemaAssertion('{"key": "val"}', { requiredKeys: [] });
		expect(r.passed).toBe(true);
	});

	it("fails for JSON null", () => {
		const r = runJsonSchemaAssertion("null");
		expect(r.passed).toBe(false);
	});
});
