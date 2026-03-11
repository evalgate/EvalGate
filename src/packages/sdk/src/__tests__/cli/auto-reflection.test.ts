import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssertionLLMConfig } from "../../assertions";
import {
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	createAutoLedgerEntry,
} from "../../cli/auto-ledger";
import {
	type AutoReflection,
	assertValidAutoReflection,
	generateAndWriteAutoReflection,
	generateAutoReflection,
	readAutoReflection,
	resolveAutoReflectionPath,
	resolveAutoReflectionRelativePath,
	writeAutoReflection,
} from "../../cli/auto-reflection";

function makeTempProjectRoot(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-reflection-"));
}

function buildEntry(overrides: Partial<AutoLedgerEntry> = {}): AutoLedgerEntry {
	return createAutoLedgerEntry({
		experimentId: "exp-001",
		sessionId: "session-001",
		timestamp: "2026-03-10T14:00:00.000Z",
		parentExperimentId: "session-001",
		baselineRef: ".evalgate/auto/runs/baseline.json",
		candidateRef: ".evalgate/auto/runs/candidate.json",
		targetFailureMode: "tone_mismatch",
		targetClusterId: "cluster-tone-1",
		mutationTarget: "prompts/support.md",
		mutationFamily: "few-shot-examples",
		patchSummary: "Added a short few-shot example to calibrate tone.",
		patchHash: "abc123def456",
		targetedSpecs: ["spec-1"],
		holdoutSpecs: [],
		utilityScore: 0.42,
		objectiveReductionRatio: 0.5,
		baselineObjectiveRate: 0.4,
		candidateObjectiveRate: 0.2,
		regressions: 1,
		improvements: 2,
		holdoutRegressions: 0,
		passRateDeltaRatio: 0.3,
		correctedPassRateDeltaRatio: 0.3,
		passRateBasis: "raw",
		latencyDeltaRatio: -0.1,
		costDeltaRatio: -0.2,
		decision: "keep",
		hardVetoReason: null,
		costUsd: 0.11,
		durationMs: 900,
		detailsPath: ".evalgate/auto/details/exp-001.json",
		reflection: null,
		...overrides,
	});
}

function buildDetails(
	overrides: Partial<AutoExperimentDetails> = {},
): AutoExperimentDetails {
	return {
		experimentId: "exp-001",
		sessionId: "session-001",
		baselineRef: ".evalgate/auto/runs/baseline.json",
		candidateRef: ".evalgate/auto/runs/candidate.json",
		mutation: {
			target: "prompts/support.md",
			family: "few-shot-examples",
			summary: "Added a short few-shot example to calibrate tone.",
		},
		utility: {
			inputMetrics: {
				baselineObjectiveRate: 0.4,
				candidateObjectiveRate: 0.2,
				regressions: 1,
			},
			weights: {
				objective_reduction_ratio: 1,
			},
			computedScore: 0.42,
		},
		veto: {
			evaluatedRules: ["latency_ceiling"],
			matchedRule: null,
		},
		targetedSpecSummary: {
			passToFailIds: ["spec-2"],
			failToPassIds: ["spec-1", "spec-3"],
			unchangedIds: [],
		},
		holdoutSpecSummary: {
			passToFailIds: [],
			failToPassIds: [],
			unchangedIds: [],
		},
		anomalies: {
			latencySpikes: [],
			unexpectedFlips: [],
			missingFailureModeMapping: [],
		},
		reportPaths: {
			baseline: ".evalgate/auto/runs/baseline.json",
			candidate: ".evalgate/auto/runs/candidate.json",
			targeted: ".evalgate/auto/runs/candidate.json",
		},
		reflection: null,
		...overrides,
	};
}

describe("auto-reflection", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("writes and reads reflection artifacts with validated paths", () => {
		const projectRoot = makeTempProjectRoot();
		try {
			const reflection: AutoReflection = {
				schemaVersion: "1",
				experimentId: "exp-001",
				sessionId: "session-001",
				generatedAt: "2026-03-10T14:00:00.000Z",
				targetFailureMode: "tone_mismatch",
				mutationFamily: "few-shot-examples",
				decision: "keep",
				whatChanged: "Added a short few-shot example to calibrate tone.",
				whyItLikelyHelped: "The example made the desired tone more concrete.",
				whatRegressed: null,
				whatToTryNext: ["Tighten the desired tone rubric."],
				whatNotToRetry: [],
				clusterId: "cluster-tone-1",
				utilityScore: 0.42,
				objectiveRateBefore: 0.4,
				objectiveRateAfter: 0.2,
				regressions: 0,
				hardVetoReason: null,
			};
			const reflectionPath = resolveAutoReflectionPath("exp-001", projectRoot);
			writeAutoReflection(reflection, reflectionPath);

			expect(resolveAutoReflectionRelativePath("exp-001", projectRoot)).toBe(
				path.join(".evalgate", "auto", "reflections", "exp-001.json"),
			);
			expect(readAutoReflection(reflectionPath)).toEqual(reflection);
			expect(() =>
				assertValidAutoReflection({ ...reflection, whatToTryNext: [""] }),
			).toThrow();
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("generates and writes a reflection via Anthropic JSON output", async () => {
		const projectRoot = makeTempProjectRoot();
		const entry = buildEntry();
		const details = buildDetails();
		const llmConfig: AssertionLLMConfig = {
			provider: "anthropic",
			apiKey: "sk-ant-test",
			model: "claude-haiku-4-5-20251001",
		};
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				content: [
					{
						text: JSON.stringify({
							whyItLikelyHelped:
								"The example anchored the assistant on the desired support tone.",
							whatRegressed: "One previously stable formatting spec flipped.",
							whatToTryNext: [
								"Add a compact tone checklist above the examples.",
								"Reduce the example verbosity to keep the prompt tight.",
							],
							whatNotToRetry: ["Do not add more than three examples."],
						}),
					},
				],
			}),
			text: async () => "ok",
		});

		try {
			const reflection = await generateAndWriteAutoReflection({
				entry,
				details,
				projectRoot,
				llmConfig,
				maxTokens: 900,
			});
			const reflectionPath = resolveAutoReflectionPath(
				entry.experimentId,
				projectRoot,
			);
			const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
				string,
				RequestInit,
			];
			const body = JSON.parse(String(init.body)) as {
				model: string;
				max_tokens: number;
				messages: Array<{ role: string; content: string }>;
			};

			expect(body.model).toBe("claude-haiku-4-5-20251001");
			expect(body.max_tokens).toBe(500);
			expect(body.messages[0]?.content).toContain("Return JSON only");
			expect(reflection.whatChanged).toBe(details.mutation.summary);
			expect(reflection.whyItLikelyHelped).toContain("desired support tone");
			expect(reflection.whatToTryNext).toHaveLength(2);
			expect(reflection.whatNotToRetry).toEqual([
				"Do not add more than three examples.",
			]);
			expect(fs.existsSync(reflectionPath)).toBe(true);
			expect(readAutoReflection(reflectionPath)).toEqual(reflection);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("falls back to a warning-safe reflection when the LLM call fails", async () => {
		const projectRoot = makeTempProjectRoot();
		const entry = buildEntry({
			decision: "vetoed",
			hardVetoReason: "latency_ceiling",
			regressions: 2,
			utilityScore: null,
		});
		const details = buildDetails();
		const warn = vi.fn();
		const llmConfig: AssertionLLMConfig = {
			provider: "anthropic",
			apiKey: "sk-ant-test",
		};
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("network down"),
		);

		try {
			const reflection = await generateAutoReflection({
				entry,
				details,
				projectRoot,
				llmConfig,
				logger: { warn },
			});
			writeAutoReflection(
				reflection,
				resolveAutoReflectionPath(entry.experimentId, projectRoot),
			);

			expect(warn).toHaveBeenCalledOnce();
			expect(reflection.whatToTryNext).toEqual([]);
			expect(reflection.whatNotToRetry).toEqual([entry.mutationFamily]);
			expect(reflection.whyItLikelyHelped).toBeNull();
			expect(reflection.whatRegressed).toContain(
				"Hard veto reason: latency_ceiling.",
			);
			expect(reflection.utilityScore).toBe(0);
			expect(
				readAutoReflection(
					resolveAutoReflectionPath(entry.experimentId, projectRoot),
				),
			).toEqual(reflection);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
