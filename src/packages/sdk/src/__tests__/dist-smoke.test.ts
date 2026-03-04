/**
 * Compiled-output smoke tests — Tier 0 harness.
 *
 * These tests import from the compiled `dist/` directory, NOT from source.
 * They verify the public API contract that consumers actually `require()`.
 *
 * Run after `pnpm build`: `pnpm test:dist`
 */
import { describe, expect, it } from "vitest";
import * as path from "path";
import * as fs from "fs";

const DIST_ROOT = path.resolve(__dirname, "../../dist");

/**
 * Guard: skip entire suite if dist/ hasn't been built yet.
 * The CI script (`test:dist`) always builds first, but local runs
 * of `pnpm test` may not have a dist/ directory.
 */
const distExists = fs.existsSync(path.join(DIST_ROOT, "index.js"));

describe.skipIf(!distExists)("dist-smoke: compiled output contract", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const sdk = require(path.join(DIST_ROOT, "index.js"));
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const errors = require(path.join(DIST_ROOT, "errors.js"));

	// ── 1. Export identity ──────────────────────────────────────
	describe("export identity", () => {
		it("sdk.ValidationError is the real ValidationError, not EvalGateError", () => {
			expect(sdk.ValidationError).toBe(errors.ValidationError);
		});

		it("new ValidationError().name === 'ValidationError'", () => {
			expect(new sdk.ValidationError("x").name).toBe("ValidationError");
		});

		it("instanceof discrimination: RateLimitError is NOT instanceof ValidationError", () => {
			const rle = new sdk.RateLimitError("slow");
			expect(rle instanceof sdk.ValidationError).toBe(false);
		});

		it("instanceof upcast: ValidationError IS instanceof EvalGateError", () => {
			const ve = new sdk.ValidationError("bad");
			expect(ve instanceof sdk.EvalGateError).toBe(true);
		});

		it("SDKError backward compat alias equals EvalGateError", () => {
			expect(sdk.SDKError).toBe(sdk.EvalGateError);
		});

		it("all error classes have correct .name", () => {
			expect(new sdk.RateLimitError("x").name).toBe("RateLimitError");
			expect(new sdk.AuthenticationError().name).toBe("AuthenticationError");
			expect(new sdk.NetworkError().name).toBe("NetworkError");
			expect(new sdk.EvalGateError("x").name).toBe("EvalGateError");
		});
	});

	// ── 2. Key functions exist ──────────────────────────────────
	describe("key exports exist", () => {
		it("createResult is a function", () => {
			expect(typeof sdk.createResult).toBe("function");
		});

		it("defineEval is a function", () => {
			expect(typeof sdk.defineEval).toBe("function");
		});

		it("traceWorkflowStep is a function", () => {
			expect(typeof sdk.traceWorkflowStep).toBe("function");
		});

		it("parseArgs is a function", () => {
			expect(typeof sdk.parseArgs).toBe("function");
		});

		it("Logger is a constructor", () => {
			expect(typeof sdk.Logger).toBe("function");
		});

		it("WorkflowTracer is a constructor", () => {
			expect(typeof sdk.WorkflowTracer).toBe("function");
		});

		it("expect is a function (assertions)", () => {
			expect(typeof sdk.expect).toBe("function");
		});
	});

	// ── 3. createResult preserves all fields ────────────────────
	describe("createResult field preservation", () => {
		it("preserves output, durationMs, and tokens", () => {
			const r = sdk.createResult({
				pass: true,
				score: 90,
				output: "generated text",
				durationMs: 250,
				tokens: 150,
			});
			expect(r.output).toBe("generated text");
			expect(r.durationMs).toBe(250);
			expect(r.tokens).toBe(150);
		});

		it("clamps score to 0-100", () => {
			expect(sdk.createResult({ pass: true, score: 150 }).score).toBe(100);
			expect(sdk.createResult({ pass: false, score: -10 }).score).toBe(0);
		});

		it("leaves optional fields undefined when not provided", () => {
			const r = sdk.createResult({ pass: true, score: 50 });
			expect(r.output).toBeUndefined();
			expect(r.durationMs).toBeUndefined();
			expect(r.tokens).toBeUndefined();
		});
	});

	// ── 4. parseArgs defaults ───────────────────────────────────
	describe("parseArgs defaults", () => {
		it("baseUrl defaults to api.evalgate.com, not localhost", () => {
			const saved = process.env.EVALGATE_BASE_URL;
			delete process.env.EVALGATE_BASE_URL;
			try {
				const result = sdk.parseArgs(["--apiKey", "k", "--evaluationId", "1"]);
				if (result.ok) {
					expect(result.args.baseUrl).toBe("https://api.evalgate.com");
				}
			} finally {
				if (saved !== undefined) process.env.EVALGATE_BASE_URL = saved;
			}
		});
	});

	// ── 5. Logger.child() formatting ────────────────────────────
	describe("Logger.child formatting", () => {
		it("string prefix produces PARENT:CHILD", () => {
			const entries: unknown[] = [];
			const logger = new sdk.Logger({
				prefix: "PARENT",
				handler: (e: unknown) => entries.push(e),
			});
			const child = logger.child("CHILD");
			child.info("test message");
			expect((entries[0] as { prefix: string }).prefix).toBe("PARENT:CHILD");
		});
	});

	// ── 6. traceWorkflowStep is async ───────────────────────────
	describe("traceWorkflowStep async", () => {
		it("returns a Promise", () => {
			const mockTracer = {
				startAgentSpan: async () => ({
					spanId: "s",
					agentName: "A",
					startTime: new Date().toISOString(),
				}),
				endAgentSpan: async () => {},
			};
			const result = sdk.traceWorkflowStep(
				mockTracer,
				"Agent",
				async () => "ok",
			);
			expect(result).toBeInstanceOf(Promise);
			// Clean up the promise to avoid unhandled rejection
			result.catch(() => {});
		});
	});

	// ── 7. Subpath exports resolve ──────────────────────────────
	describe("subpath exports", () => {
		it("assertions module loads", () => {
			const assertionsPath = path.join(DIST_ROOT, "assertions.js");
			if (fs.existsSync(assertionsPath)) {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const assertions = require(assertionsPath);
				expect(typeof assertions.expect).toBe("function");
				expect(typeof assertions.hasSentiment).toBe("function");
			}
		});

		it("regression module loads", () => {
			const regressionPath = path.join(DIST_ROOT, "regression.js");
			if (fs.existsSync(regressionPath)) {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const regression = require(regressionPath);
				expect(regression.GATE_EXIT).toBeDefined();
			}
		});

		it("workflows module loads", () => {
			const workflowsPath = path.join(DIST_ROOT, "workflows.js");
			if (fs.existsSync(workflowsPath)) {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const workflows = require(workflowsPath);
				expect(typeof workflows.WorkflowTracer).toBe("function");
				expect(typeof workflows.traceWorkflowStep).toBe("function");
			}
		});
	});
});
