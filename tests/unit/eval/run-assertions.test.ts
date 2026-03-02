import { describe, expect, it } from "vitest";
import {
	KNOWN_ASSERTION_KEYS,
	runAssertions,
} from "@/lib/eval/assertion-runners/run-assertions";

// ── runAssertions ─────────────────────────────────────────────────────────────

describe("runAssertions", () => {
	it("returns a v1 envelope", () => {
		const result = runAssertions("Hello world");
		expect(result.version).toBe("v1");
		expect(Array.isArray(result.assertions)).toBe(true);
	});

	it("runs pii and toxicity by default", () => {
		const result = runAssertions("Call me at 555-123-4567");
		const keys = result.assertions.map((a) => a.key);
		expect(keys).toContain("pii");
		expect(keys).toContain("toxicity");
	});

	it("returns exactly as many assertions as enabled runners", () => {
		const result = runAssertions("some output", ["pii"]);
		expect(result.assertions).toHaveLength(1);
		expect(result.assertions[0]!.key).toBe("pii");
	});

	it("runs json_schema runner when enabled", () => {
		const result = runAssertions('{"name":"Alice"}', ["json_schema"]);
		expect(result.assertions).toHaveLength(1);
		expect(result.assertions[0]!.key).toBe("json_schema");
	});

	it("detects PII in output", () => {
		const result = runAssertions("My email is user@example.com", ["pii"]);
		const pii = result.assertions.find((a) => a.key === "pii")!;
		expect(pii.passed).toBe(false);
	});

	it("passes PII check on clean output", () => {
		const result = runAssertions("The sky is blue.", ["pii"]);
		const pii = result.assertions.find((a) => a.key === "pii")!;
		expect(pii.passed).toBe(true);
	});

	it("detects toxicity in output", () => {
		const result = runAssertions("I hate you", ["toxicity"]);
		const tox = result.assertions.find((a) => a.key === "toxicity")!;
		expect(tox.passed).toBe(false);
	});

	it("passes toxicity check on clean output", () => {
		const result = runAssertions("Have a great day!", ["toxicity"]);
		const tox = result.assertions.find((a) => a.key === "toxicity")!;
		expect(tox.passed).toBe(true);
	});

	it("valid JSON passes json_schema check", () => {
		const result = runAssertions('{"status":"ok"}', ["json_schema"]);
		const js = result.assertions.find((a) => a.key === "json_schema")!;
		expect(js.passed).toBe(true);
	});

	it("non-JSON fails json_schema check", () => {
		const result = runAssertions("not json", ["json_schema"]);
		const js = result.assertions.find((a) => a.key === "json_schema")!;
		expect(js.passed).toBe(false);
	});

	it("returns empty assertions for empty enabled list", () => {
		const result = runAssertions("anything", []);
		expect(result.assertions).toHaveLength(0);
	});

	it("runs all three runners together", () => {
		const result = runAssertions('{"msg":"hello"}', [
			"pii",
			"toxicity",
			"json_schema",
		]);
		expect(result.assertions).toHaveLength(3);
		const keys = result.assertions.map((a) => a.key);
		expect(keys).toContain("pii");
		expect(keys).toContain("toxicity");
		expect(keys).toContain("json_schema");
	});

	it("each assertion result has required fields", () => {
		const result = runAssertions("test", ["pii", "toxicity"]);
		for (const assertion of result.assertions) {
			expect(typeof assertion.key).toBe("string");
			expect(typeof assertion.passed).toBe("boolean");
			expect(typeof assertion.category).toBe("string");
		}
	});
});

// ── KNOWN_ASSERTION_KEYS ──────────────────────────────────────────────────────

describe("KNOWN_ASSERTION_KEYS", () => {
	it("contains the three standard runners", () => {
		expect(KNOWN_ASSERTION_KEYS).toContain("pii");
		expect(KNOWN_ASSERTION_KEYS).toContain("toxicity");
		expect(KNOWN_ASSERTION_KEYS).toContain("json_schema");
	});

	it("has exactly 3 entries", () => {
		expect(KNOWN_ASSERTION_KEYS).toHaveLength(3);
	});
});
