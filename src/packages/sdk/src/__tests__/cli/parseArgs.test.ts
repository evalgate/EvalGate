import { afterEach, describe, expect, it, vi } from "vitest";
import { parseArgs, runCheck } from "../../cli/check";
import { EXIT } from "../../cli/constants";
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
			"--apiKey",
			"key",
			"--evaluationId",
			"42",
			"--baseUrl",
			"http://from-flag:9090",
		]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.baseUrl).toBe("http://from-flag:9090");
		}
	});
});

describe("parseArgs --dry-run", () => {
	it("parses --dry-run flag as dryRun: true", () => {
		const result = parseArgs([
			"--apiKey",
			"key",
			"--evaluationId",
			"42",
			"--dry-run",
		]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.dryRun).toBe(true);
		}
	});

	it("dryRun is undefined when --dry-run is not passed", () => {
		const result = parseArgs(["--apiKey", "key", "--evaluationId", "42"]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.dryRun).toBeUndefined();
		}
	});
});

describe("runCheck --dry-run exit code override", () => {
	it("returns EXIT.PASS (0) even when gate would fail", async () => {
		// Mock fetch to return a failing score
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			headers: new Headers(),
			text: async () =>
				JSON.stringify({
					score: 10,
					total: 5,
					evaluationRunId: 1,
				}),
		}) as unknown as typeof fetch;

		try {
			const exitCode = await runCheck({
				baseUrl: "http://localhost:3000",
				apiKey: "test-key",
				minScore: 90,
				allowWeakEvidence: true,
				evaluationId: "42",
				baseline: "published",
				format: "json",
				explain: false,
				share: "never",
				dryRun: true,
			});
			expect(exitCode).toBe(EXIT.PASS);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
