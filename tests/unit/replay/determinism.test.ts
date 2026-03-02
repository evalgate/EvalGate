import { describe, expect, it } from "vitest";
import {
	classifyDeterminism,
	formatTierSummary,
	type SnapshotForClassification,
	validateReplayResult,
} from "@/lib/replay/determinism";

const baseSnapshot: SnapshotForClassification = {
	commitSha: "abc123def456",
	toolOutputCaptureMode: "full",
	externalDeps: [],
	modelConfig: { model: "gpt-4o", temperature: 0.0 },
	spans: [],
};

describe("classifyDeterminism", () => {
	it("classifies as Tier A when all criteria met", () => {
		const result = classifyDeterminism(baseSnapshot);
		expect(result.tier).toBe("A");
		expect(result.label).toBe("Deterministic");
		expect(result.confidence).toBe(0.95);
	});

	it("classifies as Tier B when commitSha is missing", () => {
		const snapshot = { ...baseSnapshot, commitSha: null };
		const result = classifyDeterminism(snapshot);
		expect(result.tier).toBe("B");
	});

	it("classifies as Tier B when temperature not captured", () => {
		const snapshot: SnapshotForClassification = {
			...baseSnapshot,
			modelConfig: { model: "gpt-4o", temperature: null },
		};
		const result = classifyDeterminism(snapshot);
		expect(result.tier).toBe("B");
	});

	it("classifies as Tier B when model not captured", () => {
		const snapshot: SnapshotForClassification = {
			...baseSnapshot,
			modelConfig: { model: null, temperature: 0.0 },
		};
		const result = classifyDeterminism(snapshot);
		expect(result.tier).toBe("B");
	});

	it("classifies as Tier B when tool calls exist with non-full capture", () => {
		const snapshot: SnapshotForClassification = {
			...baseSnapshot,
			spans: [{ toolCalls: [{ captureMode: "none" }] }],
		};
		const result = classifyDeterminism(snapshot);
		expect(result.tier).toBe("B");
	});

	it("classifies as Tier C when uncaptured external deps exist", () => {
		const snapshot: SnapshotForClassification = {
			...baseSnapshot,
			externalDeps: [{ captured: false, type: "api" }],
		};
		const result = classifyDeterminism(snapshot);
		expect(result.tier).toBe("C");
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it("includes reasons in output", () => {
		const result = classifyDeterminism(baseSnapshot);
		expect(result.reasons.length).toBeGreaterThan(0);
	});

	it("respects custom tolerances", () => {
		const result = classifyDeterminism(baseSnapshot, {
			tierAScoreTolerance: 0.02,
		});
		expect(result.scoreTolerance).toBe(0.02);
	});
});

describe("validateReplayResult", () => {
	it("passes Tier A when delta within 5%", () => {
		const result = validateReplayResult("A", 0.9, 0.88);
		expect(result.passed).toBe(true);
		expect(result.withinTolerance).toBe(true);
	});

	it("fails Tier A when delta exceeds 5%", () => {
		const result = validateReplayResult("A", 0.9, 0.8);
		expect(result.passed).toBe(false);
	});

	it("passes Tier B when delta within 15%", () => {
		const result = validateReplayResult("B", 0.9, 0.8);
		expect(result.passed).toBe(true);
	});

	it("fails Tier B when delta exceeds 15%", () => {
		const result = validateReplayResult("B", 0.9, 0.7);
		expect(result.passed).toBe(false);
	});

	it("always passes Tier C regardless of delta", () => {
		const result = validateReplayResult("C", 0.9, 0.1);
		expect(result.passed).toBe(true);
	});

	it("calculates correct delta", () => {
		const result = validateReplayResult("A", 0.9, 0.85);
		expect(result.delta).toBeCloseTo(0.05);
	});

	it("respects custom tier A tolerance", () => {
		const result = validateReplayResult("A", 0.9, 0.88, {
			tierAScoreTolerance: 0.01,
		});
		expect(result.passed).toBe(false);
	});
});

describe("formatTierSummary", () => {
	it("includes tier letter and label", () => {
		const classification = classifyDeterminism(baseSnapshot);
		const summary = formatTierSummary(classification);
		expect(summary).toContain("Tier: A");
		expect(summary).toContain("Deterministic");
	});

	it("includes score tolerance", () => {
		const classification = classifyDeterminism(baseSnapshot);
		const summary = formatTierSummary(classification);
		expect(summary).toContain("Tolerance");
	});

	it("includes warnings for Tier C", () => {
		const snapshot: SnapshotForClassification = {
			...baseSnapshot,
			externalDeps: [{ captured: false, type: "api" }],
		};
		const classification = classifyDeterminism(snapshot);
		const summary = formatTierSummary(classification);
		expect(summary).toContain("⚠");
	});
});
