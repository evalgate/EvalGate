import { describe, expect, it } from "vitest";
import {
	type BehaviorPoint,
	buildCoverageModel,
	DEFAULT_GAP_SEED_PHRASES,
	formatCoverageReport,
} from "@/lib/dataset/coverage-model";

const refundPoints: BehaviorPoint[] = [
	{ id: "t1", text: "What is the refund policy for damaged goods?" },
	{ id: "t2", text: "How do I request a full refund for my order?" },
	{ id: "t3", text: "Can I get a partial refund on a subscription?" },
];

const diversePoints: BehaviorPoint[] = [
	{ id: "d1", text: "Refund policy for damaged items and returns" },
	{ id: "d2", text: "Billing invoice payment processing methods" },
	{ id: "d3", text: "Login authentication security two-factor" },
	{ id: "d4", text: "Product search filter catalog inventory" },
	{ id: "d5", text: "Shipping delivery tracking address update" },
	{ id: "d6", text: "Customer support ticket escalation priority" },
];

describe("buildCoverageModel — empty input", () => {
	it("returns zero coverage for empty dataset", () => {
		const model = buildCoverageModel([]);
		expect(model.totalTestCases).toBe(0);
		expect(model.clusters).toHaveLength(0);
		expect(model.coverageRatio).toBe(0);
	});

	it("still returns gaps for empty dataset", () => {
		const model = buildCoverageModel([]);
		expect(model.gaps.length).toBeGreaterThan(0);
	});

	it("summary mentions 0 coverage", () => {
		const model = buildCoverageModel([]);
		expect(model.summary.toLowerCase()).toContain("0");
	});
});

describe("buildCoverageModel — small dataset", () => {
	it("counts total test cases", () => {
		const model = buildCoverageModel(refundPoints);
		expect(model.totalTestCases).toBe(3);
	});

	it("creates at least one cluster", () => {
		const model = buildCoverageModel(refundPoints);
		expect(model.clusters.length).toBeGreaterThan(0);
	});

	it("all test cases assigned to a cluster", () => {
		const model = buildCoverageModel(refundPoints);
		const totalAssigned = model.clusters.reduce(
			(sum, c) => sum + c.memberIds.length,
			0,
		);
		expect(totalAssigned).toBe(refundPoints.length);
	});

	it("coverage ratio is between 0 and 1", () => {
		const model = buildCoverageModel(refundPoints);
		expect(model.coverageRatio).toBeGreaterThanOrEqual(0);
		expect(model.coverageRatio).toBeLessThanOrEqual(1);
	});

	it("cluster labels are non-empty strings", () => {
		const model = buildCoverageModel(refundPoints);
		for (const cluster of model.clusters) {
			expect(cluster.label.length).toBeGreaterThan(0);
		}
	});

	it("cluster density is between 0 and 1", () => {
		const model = buildCoverageModel(refundPoints);
		for (const cluster of model.clusters) {
			expect(cluster.density).toBeGreaterThanOrEqual(0);
			expect(cluster.density).toBeLessThanOrEqual(1);
		}
	});
});

describe("buildCoverageModel — diverse dataset", () => {
	it("creates multiple clusters for diverse input", () => {
		const model = buildCoverageModel(diversePoints);
		expect(model.clusters.length).toBeGreaterThan(1);
	});

	it("diverse dataset has higher coverage ratio than narrow dataset", () => {
		const narrowModel = buildCoverageModel(refundPoints);
		const diverseModel = buildCoverageModel(diversePoints);
		expect(diverseModel.coverageRatio).toBeGreaterThanOrEqual(
			narrowModel.coverageRatio,
		);
	});

	it("gaps are sorted by importance descending", () => {
		const model = buildCoverageModel(diversePoints);
		for (let i = 0; i < model.gaps.length - 1; i++) {
			expect(model.gaps[i]!.importance).toBeGreaterThanOrEqual(
				model.gaps[i + 1]!.importance,
			);
		}
	});

	it("gap distance is between 0 and 1", () => {
		const model = buildCoverageModel(diversePoints);
		for (const gap of model.gaps) {
			expect(gap.gapDistance).toBeGreaterThanOrEqual(0);
			expect(gap.gapDistance).toBeLessThanOrEqual(1);
		}
	});
});

describe("buildCoverageModel — custom k", () => {
	it("respects k=1 (all in one cluster)", () => {
		const model = buildCoverageModel(diversePoints, 1);
		expect(model.clusters).toHaveLength(1);
	});

	it("respects k equal to number of points", () => {
		const model = buildCoverageModel(refundPoints, 3);
		expect(model.clusters.length).toBeLessThanOrEqual(3);
	});
});

describe("formatCoverageReport", () => {
	it("returns a non-empty string", () => {
		const model = buildCoverageModel(diversePoints);
		const report = formatCoverageReport(model);
		expect(report.length).toBeGreaterThan(50);
	});

	it("includes coverage report heading", () => {
		const model = buildCoverageModel(diversePoints);
		const report = formatCoverageReport(model);
		expect(report).toContain("Coverage Report");
	});

	it("includes gaps section when gaps exist", () => {
		const model = buildCoverageModel(refundPoints);
		const report = formatCoverageReport(model);
		if (model.gaps.length > 0) {
			expect(report).toContain("Gap");
		}
	});

	it("includes cluster section", () => {
		const model = buildCoverageModel(diversePoints);
		const report = formatCoverageReport(model);
		expect(report).toContain("Cluster");
	});

	it("empty model report says no test cases", () => {
		const model = buildCoverageModel([]);
		const report = formatCoverageReport(model);
		expect(report).toContain("0");
	});
});

describe("DEFAULT_GAP_SEED_PHRASES and custom seedPhrases", () => {
	it("DEFAULT_GAP_SEED_PHRASES is exported and non-empty", () => {
		expect(DEFAULT_GAP_SEED_PHRASES.length).toBeGreaterThan(0);
		expect(typeof DEFAULT_GAP_SEED_PHRASES[0]).toBe("string");
	});

	it("custom seedPhrases replace default gap detection", () => {
		const domainPhrases = [
			"quantum entanglement test",
			"photon collision event",
		];
		const model = buildCoverageModel(refundPoints, undefined, {
			seedPhrases: domainPhrases,
		});
		// Domain phrases are completely unrelated to refund points → both should appear as gaps
		expect(model.gaps.length).toBeGreaterThan(0);
		expect(model.gaps[0]!.description).toMatch(
			/quantum entanglement|photon collision/,
		);
	});

	it("passing empty seedPhrases produces no gaps", () => {
		const model = buildCoverageModel(refundPoints, undefined, {
			seedPhrases: [],
		});
		expect(model.gaps).toHaveLength(0);
	});
});
