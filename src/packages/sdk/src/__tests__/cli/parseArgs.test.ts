import { describe, expect, it, afterEach } from "vitest";
import { parseArgs } from "../../cli/check";
import { DEFAULT_BASE_URL } from "../../constants";

describe("parseArgs baseUrl defaults", () => {
	const savedEnv = process.env.EVALGATE_BASE_URL;

	afterEach(() => {
		if (savedEnv !== undefined) {
			process.env.EVALGATE_BASE_URL = savedEnv;
		} else {
			delete process.env.EVALGATE_BASE_URL;
		}
	});

	it("should default baseUrl to api.evalgate.com, not localhost", () => {
		delete process.env.EVALGATE_BASE_URL;
		const result = parseArgs(["--apiKey", "key", "--evaluationId", "42"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.baseUrl).toBe(DEFAULT_BASE_URL);
			expect(result.args.baseUrl).toBe("https://api.evalgate.com");
		}
	});

	it("should respect EVALGATE_BASE_URL env var over default", () => {
		process.env.EVALGATE_BASE_URL = "http://custom:8080";
		const result = parseArgs(["--apiKey", "key", "--evaluationId", "42"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.baseUrl).toBe("http://custom:8080");
		}
	});

	it("should respect --baseUrl flag over env var", () => {
		process.env.EVALGATE_BASE_URL = "http://from-env:8080";
		const result = parseArgs([
			"--apiKey", "key",
			"--evaluationId", "42",
			"--baseUrl", "http://from-flag:9090",
		]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.baseUrl).toBe("http://from-flag:9090");
		}
	});
});
