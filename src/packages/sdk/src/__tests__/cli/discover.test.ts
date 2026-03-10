import { describe, expect, it } from "vitest";

import { calculateDiversityStats, type SpecAnalysis } from "../../cli/discover";

describe("calculateDiversityStats", () => {
	it("detects redundant spec pairs from similar fingerprints", () => {
		const specs: SpecAnalysis[] = [
			{
				id: "spec-a",
				name: "refund partial payment policy",
				file: "evals/refund-a.spec.ts",
				tags: ["payments", "refunds"],
				hasAssertions: true,
				usesModels: true,
				usesTools: false,
				complexity: "medium",
				fingerprintText:
					"refund partial payment policy customer invoice reimbursement",
			},
			{
				id: "spec-b",
				name: "refund partial payment request",
				file: "evals/refund-b.spec.ts",
				tags: ["payments", "refunds"],
				hasAssertions: true,
				usesModels: true,
				usesTools: false,
				complexity: "medium",
				fingerprintText:
					"refund partial payment request customer reimbursement invoice",
			},
			{
				id: "spec-c",
				name: "support tone empathy",
				file: "evals/tone.spec.ts",
				tags: ["tone"],
				hasAssertions: true,
				usesModels: false,
				usesTools: false,
				complexity: "simple",
				fingerprintText: "support empathy calm tone angry customer",
			},
		];

		const stats = calculateDiversityStats(specs, 0.5);

		expect(stats.redundantPairs).toHaveLength(1);
		expect(stats.redundantPairs[0]?.leftSpecId).toBe("spec-a");
		expect(stats.redundantPairs[0]?.rightSpecId).toBe("spec-b");
		expect(stats.score).toBeLessThan(100);
		expect(stats.averageNearestNeighborSimilarity).toBeGreaterThan(0);
	});

	it("returns a perfect score for a single spec", () => {
		const stats = calculateDiversityStats([
			{
				id: "spec-a",
				name: "single spec",
				file: "evals/single.spec.ts",
				tags: ["general"],
				hasAssertions: true,
				usesModels: false,
				usesTools: false,
				complexity: "simple",
				fingerprintText: "single spec fingerprint",
			},
		]);

		expect(stats.score).toBe(100);
		expect(stats.redundantPairs).toHaveLength(0);
	});
});
