import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
	AUTO_LEDGER_SCHEMA_VERSION,
	type AutoExperimentDetails,
	type AutoLedgerEntry,
	appendAutoLedgerEntry,
	assertValidAutoLedgerEntry,
	createAutoLedgerEntry,
	readAutoExperimentDetails,
	readAutoLedgerEntries,
	resolveAutoDetailsPath,
	resolveAutoDetailsRelativePath,
	resolveAutoWorkspacePaths,
	writeAutoExperimentDetails,
} from "../../cli/auto-ledger";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "evalgate-auto-ledger-"));
}

function buildEntry(
	projectRoot: string,
	overrides: Partial<AutoLedgerEntry> = {},
): AutoLedgerEntry {
	return createAutoLedgerEntry({
		experimentId: "exp-001",
		sessionId: "session-001",
		timestamp: "2025-01-02T03:04:05.000Z",
		parentExperimentId: "exp-000",
		baselineRef: "baseline",
		candidateRef: "candidate",
		targetFailureMode: "tone_mismatch",
		targetClusterId: null,
		mutationTarget: "prompts/support.md",
		mutationFamily: "append_instruction",
		patchSummary: "Add escalation guidance",
		patchHash: "hash-123",
		targetedSpecs: ["spec-a", "spec-b"],
		holdoutSpecs: ["spec-h1"],
		utilityScore: 0.12,
		objectiveReductionRatio: 0.2,
		baselineObjectiveRate: 0.5,
		candidateObjectiveRate: 0.3,
		regressions: 1,
		improvements: 3,
		holdoutRegressions: 0,
		passRateDeltaRatio: 0.1,
		correctedPassRateDeltaRatio: 0.08,
		passRateBasis: "corrected",
		latencyDeltaRatio: 0.02,
		costDeltaRatio: 0.01,
		decision: "keep",
		hardVetoReason: null,
		costUsd: 1.23,
		durationMs: 4567,
		detailsPath: resolveAutoDetailsRelativePath("exp-001", projectRoot),
		reflection: "Promising improvement with no holdout regressions.",
		...overrides,
	});
}

function buildDetails(
	overrides: Partial<AutoExperimentDetails> = {},
): AutoExperimentDetails {
	return {
		experimentId: "exp-001",
		sessionId: "session-001",
		baselineRef: "baseline",
		candidateRef: "candidate",
		mutation: {
			target: "prompts/support.md",
			family: "append_instruction",
			summary: "Add escalation guidance",
		},
		utility: {
			inputMetrics: {
				objectiveReductionRatio: 0.2,
				regressions: 1,
			},
			weights: {
				objectiveReductionRatio: 1,
				regressions: -1,
			},
			computedScore: 0.12,
		},
		veto: {
			evaluatedRules: ["holdout_regressions", "latency_ceiling"],
			matchedRule: null,
		},
		targetedSpecSummary: {
			passToFailIds: ["spec-a"],
			failToPassIds: ["spec-b"],
			unchangedIds: ["spec-c"],
		},
		holdoutSpecSummary: {
			passToFailIds: [],
			failToPassIds: [],
			unchangedIds: ["spec-h1"],
		},
		anomalies: {
			latencySpikes: [],
			unexpectedFlips: [],
			missingFailureModeMapping: [],
		},
		reportPaths: {
			baseline: ".evalgate/runs/baseline.json",
			candidate: ".evalgate/auto/runs/candidate.json",
			targeted: ".evalgate/auto/runs/targeted.json",
			holdout: ".evalgate/auto/runs/holdout.json",
		},
		reflection: null,
		...overrides,
	};
}

describe("auto-ledger", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves auto workspace paths under .evalgate by default", () => {
		const projectRoot = makeTempDir();
		try {
			const paths = resolveAutoWorkspacePaths(projectRoot);

			expect(paths.autoDir).toBe(path.join(projectRoot, ".evalgate", "auto"));
			expect(paths.ledgerPath).toBe(
				path.join(projectRoot, ".evalgate", "auto", "ledger.jsonl"),
			);
			expect(paths.detailsDir).toBe(
				path.join(projectRoot, ".evalgate", "auto", "details"),
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("resolves auto workspace paths under legacy .evalai when present", () => {
		const projectRoot = makeTempDir();
		try {
			fs.mkdirSync(path.join(projectRoot, ".evalai"), { recursive: true });
			const warnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => undefined);

			const paths = resolveAutoWorkspacePaths(projectRoot);

			expect(paths.autoDir).toBe(path.join(projectRoot, ".evalai", "auto"));
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("creates ledger entries with the current schema version", () => {
		const projectRoot = makeTempDir();
		try {
			const entry = buildEntry(projectRoot);

			expect(entry.schemaVersion).toBe(AUTO_LEDGER_SCHEMA_VERSION);
			assertValidAutoLedgerEntry(entry);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("appends and reads ledger entries as JSONL", () => {
		const projectRoot = makeTempDir();
		try {
			const ledgerPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"ledger.jsonl",
			);
			appendAutoLedgerEntry(buildEntry(projectRoot), ledgerPath);
			appendAutoLedgerEntry(
				buildEntry(projectRoot, {
					experimentId: "exp-002",
					detailsPath: resolveAutoDetailsRelativePath("exp-002", projectRoot),
					decision: "investigate",
					utilityScore: null,
				}),
				ledgerPath,
			);

			const entries = readAutoLedgerEntries(ledgerPath);

			expect(entries).toHaveLength(2);
			expect(entries[0]?.experimentId).toBe("exp-001");
			expect(entries[1]?.decision).toBe("investigate");
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("returns an empty list when the ledger file does not exist", () => {
		const projectRoot = makeTempDir();
		try {
			const ledgerPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"ledger.jsonl",
			);

			expect(readAutoLedgerEntries(ledgerPath)).toEqual([]);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("rejects invalid ledger entries before writing", () => {
		const projectRoot = makeTempDir();
		try {
			const ledgerPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"ledger.jsonl",
			);
			const invalidEntry = buildEntry(projectRoot, {
				parentExperimentId: "",
			});

			expect(() => appendAutoLedgerEntry(invalidEntry, ledgerPath)).toThrow(
				"entry.parentExperimentId must be a non-empty string",
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("rejects malformed JSONL rows while reading", () => {
		const projectRoot = makeTempDir();
		try {
			const ledgerPath = path.join(
				projectRoot,
				".evalgate",
				"auto",
				"ledger.jsonl",
			);
			fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
			fs.writeFileSync(ledgerPath, '{"ok": true}\nnot-json\n', "utf8");

			expect(() => readAutoLedgerEntries(ledgerPath)).toThrow(
				"Invalid JSONL at line 2",
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("writes and reads detail artifacts", () => {
		const projectRoot = makeTempDir();
		try {
			const detailsPath = resolveAutoDetailsPath("exp-001", projectRoot);
			writeAutoExperimentDetails(buildDetails(), detailsPath);

			const details = readAutoExperimentDetails(detailsPath);

			expect(details.experimentId).toBe("exp-001");
			expect(details.utility.computedScore).toBe(0.12);
			expect(details.reportPaths.holdout).toContain("holdout.json");
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("rejects malformed detail artifacts on read", () => {
		const projectRoot = makeTempDir();
		try {
			const detailsPath = resolveAutoDetailsPath("exp-001", projectRoot);
			fs.mkdirSync(path.dirname(detailsPath), { recursive: true });
			fs.writeFileSync(
				detailsPath,
				JSON.stringify({ experimentId: "exp-001", sessionId: "session-001" }),
				"utf8",
			);

			expect(() => readAutoExperimentDetails(detailsPath)).toThrow(
				"details.baselineRef must be a string",
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});

	it("computes a relative details path inside the auto workspace", () => {
		const projectRoot = makeTempDir();
		try {
			expect(resolveAutoDetailsRelativePath("exp-123", projectRoot)).toBe(
				path.join(".evalgate", "auto", "details", "exp-123.json"),
			);
		} finally {
			fs.rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
