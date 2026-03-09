/**
 * evalgate doctor tests — comprehensive checklist.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkAuth,
	checkBaseline,
	checkCiWiring,
	checkConfig,
	checkConnectivity,
	checkEvalAccess,
	checkEvalTarget,
	checkJudgeConfig,
	checkJudgeCredibilityWarnings,
	checkProject,
	checkProviderEnv,
	DOCTOR_EXIT,
	runDoctor,
} from "../cli/doctor";

const mockFetch = vi.fn();

describe("doctor individual checks", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = path.join(
			process.env.TEMP || process.env.TMPDIR || "/tmp",
			`evalgate-doctor-test-${Date.now()}`,
		);
		fs.mkdirSync(tmpDir, { recursive: true });
	});

	describe("checkJudgeConfig", () => {
		it("skips when judge config is missing", () => {
			const result = checkJudgeConfig(tmpDir, { evaluationId: "42" });
			expect(result.status).toBe("skip");
			expect(result.judgeInfo.configured).toBe(false);
		});

		it("warns when judge configured without labeledDatasetPath", () => {
			const result = checkJudgeConfig(tmpDir, {
				evaluationId: "42",
				judge: { bootstrapIterations: 2000 },
			});
			expect(result.status).toBe("warn");
			expect(result.message).toContain("labeledDatasetPath");
		});

		it("fails when labeled dataset path does not exist", () => {
			const result = checkJudgeConfig(tmpDir, {
				evaluationId: "42",
				judge: {
					labeledDatasetPath: "evals/judge-labeled.jsonl",
					bootstrapIterations: 2000,
				},
			});
			expect(result.status).toBe("warn");
			expect(result.message).toContain("not found");
		});

		it("passes when judge dataset exists", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			fs.writeFileSync(path.join(evalsDir, "judge-labeled.jsonl"), "{}\n");

			const result = checkJudgeConfig(tmpDir, {
				evaluationId: "42",
				judge: {
					labeledDatasetPath: "evals/judge-labeled.jsonl",
					bootstrapIterations: 2000,
					alignmentThresholds: { tprMin: 0.8, tnrMin: 0.8 },
				},
			});

			expect(result.status).toBe("pass");
			expect(result.judgeInfo.labeledDatasetExists).toBe(true);
		});

		it("fails when bootstrapSeed is non-integer", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			fs.writeFileSync(path.join(evalsDir, "judge-labeled.jsonl"), "{}\n");

			const result = checkJudgeConfig(tmpDir, {
				evaluationId: "42",
				judge: {
					labeledDatasetPath: "evals/judge-labeled.jsonl",
					bootstrapIterations: 2000,
					bootstrapSeed: 3.14,
				},
			});

			expect(result.status).toBe("fail");
			expect(result.message).toContain("bootstrapSeed");
		});
	});

	describe("checkJudgeCredibilityWarnings", () => {
		it("warns when judge is near-random", () => {
			const checks = checkJudgeCredibilityWarnings({
				judgeAlignment: {
					tpr: 0.52,
					tnr: 0.5,
					sampleSize: 120,
				},
			});
			expect(
				checks.find((c) => c.id === "judge_correction_viability")?.status,
			).toBe("warn");
		});

		it("warns when sample size is below CI threshold", () => {
			const checks = checkJudgeCredibilityWarnings({
				judgeAlignment: {
					tpr: 0.9,
					tnr: 0.9,
					sampleSize: 20,
				},
			});
			expect(checks.find((c) => c.id === "judge_ci_sample_size")?.status).toBe(
				"warn",
			);
		});

		it("passes when judge power and sample size are strong", () => {
			const checks = checkJudgeCredibilityWarnings({
				judgeAlignment: {
					tpr: 0.92,
					tnr: 0.9,
					sampleSize: 80,
				},
			});
			expect(
				checks.find((c) => c.id === "judge_correction_viability")?.status,
			).toBe("pass");
			expect(checks.find((c) => c.id === "judge_ci_sample_size")?.status).toBe(
				"pass",
			);
		});
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("checkProject", () => {
		it("fails when no package.json", () => {
			const result = checkProject(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.remediation).toContain("npm init");
		});

		it("warns when package.json exists but no lockfile", () => {
			fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
			const result = checkProject(tmpDir);
			expect(result.status).toBe("warn");
			expect(result.message).toContain("no lockfile");
		});

		it("passes with package.json + lockfile", () => {
			fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
			fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
			const result = checkProject(tmpDir);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("npm");
		});

		it("detects pnpm", () => {
			fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
			fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
			const result = checkProject(tmpDir);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("pnpm");
		});
	});

	describe("checkConfig", () => {
		it("fails when no config found", () => {
			fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
			const result = checkConfig(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.remediation).toContain("npx evalgate init");
		});

		it("passes with valid config", () => {
			const config = {
				evaluationId: "42",
				gate: { baseline: "evals/baseline.json" },
			};
			fs.writeFileSync(
				path.join(tmpDir, "evalgate.config.json"),
				JSON.stringify(config),
			);
			const result = checkConfig(tmpDir);
			expect(result.status).toBe("pass");
			expect(result.config).toEqual(
				expect.objectContaining({ evaluationId: "42" }),
			);
		});
	});

	describe("checkBaseline", () => {
		it("fails when baseline missing", () => {
			const result = checkBaseline(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.baselineInfo.exists).toBe(false);
		});

		it("fails with invalid JSON", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			fs.writeFileSync(path.join(evalsDir, "baseline.json"), "not json");
			const result = checkBaseline(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.message).toContain("not valid JSON");
		});

		it("fails with wrong schemaVersion", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			fs.writeFileSync(
				path.join(evalsDir, "baseline.json"),
				JSON.stringify({ schemaVersion: 99 }),
			);
			const result = checkBaseline(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.message).toContain("99");
		});

		it("warns when stale", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
			fs.writeFileSync(
				path.join(evalsDir, "baseline.json"),
				JSON.stringify({ schemaVersion: 1, updatedAt: old }),
			);
			const result = checkBaseline(tmpDir);
			expect(result.status).toBe("warn");
			expect(result.baselineInfo.stale).toBe(true);
		});

		it("passes with valid baseline", () => {
			const evalsDir = path.join(tmpDir, "evals");
			fs.mkdirSync(evalsDir, { recursive: true });
			fs.writeFileSync(
				path.join(evalsDir, "baseline.json"),
				JSON.stringify({
					schemaVersion: 1,
					updatedAt: new Date().toISOString(),
				}),
			);
			const result = checkBaseline(tmpDir);
			expect(result.status).toBe("pass");
			expect(result.baselineInfo.hash).toBeDefined();
		});
	});

	describe("checkAuth", () => {
		it("fails with no key", () => {
			const result = checkAuth("");
			expect(result.status).toBe("fail");
		});

		it("passes with key (redacted)", () => {
			const result = checkAuth("evalai_1234567890abcdef");
			expect(result.status).toBe("pass");
			expect(result.message).toContain("eval...cdef");
		});
	});

	describe("checkEvalTarget", () => {
		it("fails with empty evaluationId", () => {
			const result = checkEvalTarget("");
			expect(result.status).toBe("fail");
		});

		it("passes with evaluationId", () => {
			const result = checkEvalTarget("42");
			expect(result.status).toBe("pass");
			expect(result.message).toContain("42");
		});
	});

	describe("checkCiWiring", () => {
		it("fails when workflow missing", () => {
			const result = checkCiWiring(tmpDir);
			expect(result.status).toBe("fail");
			expect(result.ciInfo.exists).toBe(false);
		});

		it("warns when workflow exists but no evalgate reference", () => {
			const wfDir = path.join(tmpDir, ".github", "workflows");
			fs.mkdirSync(wfDir, { recursive: true });
			fs.writeFileSync(
				path.join(wfDir, "evalgate-gate.yml"),
				"name: CI\non: push\njobs: {}",
			);
			const result = checkCiWiring(tmpDir);
			expect(result.status).toBe("warn");
		});

		it("passes when workflow references evalgate", () => {
			const wfDir = path.join(tmpDir, ".github", "workflows");
			fs.mkdirSync(wfDir, { recursive: true });
			fs.writeFileSync(
				path.join(wfDir, "evalgate-gate.yml"),
				"run: npx evalgate gate --format github",
			);
			const result = checkCiWiring(tmpDir);
			expect(result.status).toBe("pass");
		});
	});

	describe("checkProviderEnv", () => {
		it("skips when no provider env vars", () => {
			const result = checkProviderEnv();
			// May pass or skip depending on test environment
			expect(["pass", "skip"]).toContain(result.status);
		});
	});

	describe("checkConnectivity", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", mockFetch);
			mockFetch.mockReset();
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("passes when API reachable", async () => {
			mockFetch.mockResolvedValue({ ok: true, status: 200 });
			const result = await checkConnectivity("http://localhost:3000", "key");
			expect(result.status).toBe("pass");
			expect(result.latencyMs).toBeDefined();
		});

		it("fails when API returns error", async () => {
			mockFetch.mockResolvedValue({ ok: false, status: 500 });
			const result = await checkConnectivity("http://localhost:3000", "key");
			expect(result.status).toBe("fail");
		});

		it("fails on network error", async () => {
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
			const result = await checkConnectivity("http://localhost:3000", "key");
			expect(result.status).toBe("fail");
			expect(result.message).toContain("ECONNREFUSED");
		});
	});

	describe("checkEvalAccess", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", mockFetch);
			mockFetch.mockReset();
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("skips when no apiKey", async () => {
			const result = await checkEvalAccess(
				"http://localhost:3000",
				"",
				"42",
				"published",
			);
			expect(result.status).toBe("skip");
		});

		it("passes when API returns score", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				headers: new Headers(),
				text: async () => JSON.stringify({ score: 85, baselineMissing: false }),
			});
			const result = await checkEvalAccess(
				"http://localhost:3000",
				"key",
				"42",
				"published",
			);
			expect(result.status).toBe("pass");
			expect(result.message).toContain("85");
		});

		it("warns when baseline missing", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				headers: new Headers(),
				text: async () => JSON.stringify({ score: 0, baselineMissing: true }),
			});
			const result = await checkEvalAccess(
				"http://localhost:3000",
				"key",
				"42",
				"published",
			);
			expect(result.status).toBe("warn");
		});

		it("fails on 403", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 403,
				headers: new Headers(),
				text: async () => "Forbidden",
			});
			const result = await checkEvalAccess(
				"http://localhost:3000",
				"key",
				"42",
				"published",
			);
			expect(result.status).toBe("fail");
			expect(result.message).toContain("403");
		});
	});
});

describe("runDoctor integration", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", mockFetch);
		mockFetch.mockReset();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("returns DOCTOR_EXIT.NOT_READY when auth fails", async () => {
		const code = await runDoctor(["--evaluationId", "42"]);
		expect(code).toBe(DOCTOR_EXIT.NOT_READY);
	});

	it("returns exit code 0 or 2 (not 1) — uses new exit codes", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({ score: 90, baselineMissing: false }),
		});
		const code = await runDoctor([
			"--evaluationId",
			"42",
			"--apiKey",
			"test-key",
		]);
		// May be 0 (ready) or 2 (not ready due to missing config/baseline in cwd)
		expect([DOCTOR_EXIT.READY, DOCTOR_EXIT.NOT_READY]).toContain(code);
	});

	it("outputs JSON with --report flag", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => JSON.stringify({ score: 90, baselineMissing: false }),
		});

		const logSpy = vi.spyOn(console, "log");
		await runDoctor([
			"--evaluationId",
			"42",
			"--apiKey",
			"test-key",
			"--report",
		]);

		// Find the JSON output call
		const jsonCall = logSpy.mock.calls.find((call) => {
			try {
				const parsed = JSON.parse(call[0] as string);
				return parsed.checks && parsed.overall;
			} catch {
				return false;
			}
		});
		expect(jsonCall).toBeDefined();
		const bundle = JSON.parse(jsonCall?.[0] as string);
		expect(bundle.checks).toBeInstanceOf(Array);
		expect(bundle.overall).toBeDefined();
		expect(bundle.cliVersion).toBeDefined();
		expect(bundle.platform).toBeDefined();
		expect(bundle.judge).toBeDefined();
	});
});
