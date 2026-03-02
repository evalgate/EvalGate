import { describe, expect, it } from "vitest";
import {
	analyzeDatasetHealth,
	computeDatasetTrend,
	computeScoreDistribution,
	detectDuplicates,
	detectOutliers,
	detectSchemaDrift,
	type DatasetEntry,
	type DatasetHealthReport,
} from "@/lib/dataset/health-analyzer";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function entry(id: string, input: string, overrides: Partial<DatasetEntry> = {}): DatasetEntry {
	return { id, input, ...overrides };
}

const HEALTHY_ENTRIES: DatasetEntry[] = [
	entry("e1", "What is the refund policy for international orders?", { expectedOutput: "30 days", lastScore: 0.9, tags: ["refund"] }),
	entry("e2", "How do I cancel my subscription?", { expectedOutput: "Go to settings", lastScore: 0.85, tags: ["cancel"] }),
	entry("e3", "Can I change my shipping address after order?", { expectedOutput: "Yes within 1 hour", lastScore: 0.8, tags: ["shipping"] }),
	entry("e4", "What payment methods do you accept?", { expectedOutput: "Visa, MC, PayPal", lastScore: 0.88, tags: ["payment"] }),
	entry("e5", "How long does standard delivery take?", { expectedOutput: "3-5 business days", lastScore: 0.92, tags: ["delivery"] }),
	entry("e6", "Is there a loyalty rewards program?", { expectedOutput: "Yes, earn points", lastScore: 0.75, tags: ["rewards"] }),
	entry("e7", "How do I track my order?", { expectedOutput: "Use tracking number", lastScore: 0.87, tags: ["tracking"] }),
];

const DUPLICATE_ENTRIES: DatasetEntry[] = [
	entry("d1", "What is the refund policy for orders?"),
	entry("d2", "What is the refund policy for orders?"), // exact duplicate
	entry("d3", "What is the refund policy for all orders?"), // near-duplicate
	entry("d4", "How do I cancel my subscription?"),
	entry("d5", "How can I cancel my subscription?"), // near-duplicate
];

// ── detectDuplicates ──────────────────────────────────────────────────────────

describe("detectDuplicates", () => {
	it("detects exact duplicates", () => {
		const pairs = detectDuplicates(DUPLICATE_ENTRIES, { exactDuplicateThreshold: 0.99 });
		const exactPairs = pairs.filter((p) => p.type === "exact");
		expect(exactPairs.length).toBeGreaterThanOrEqual(1);
		const ids = exactPairs.flatMap((p) => [p.idA, p.idB]);
		expect(ids).toContain("d1");
		expect(ids).toContain("d2");
	});

	it("detects near-duplicates", () => {
		const pairs = detectDuplicates(DUPLICATE_ENTRIES, { nearDuplicateThreshold: 0.6 });
		expect(pairs.length).toBeGreaterThan(0);
	});

	it("returns no pairs for clearly distinct entries", () => {
		const pairs = detectDuplicates(HEALTHY_ENTRIES, { nearDuplicateThreshold: 0.8 });
		expect(pairs).toHaveLength(0);
	});

	it("similarity values are between 0 and 1", () => {
		const pairs = detectDuplicates(DUPLICATE_ENTRIES, { nearDuplicateThreshold: 0.5 });
		for (const p of pairs) {
			expect(p.similarity).toBeGreaterThanOrEqual(0);
			expect(p.similarity).toBeLessThanOrEqual(1);
		}
	});

	it("never pairs an entry with itself", () => {
		const pairs = detectDuplicates(HEALTHY_ENTRIES);
		for (const p of pairs) {
			expect(p.idA).not.toBe(p.idB);
		}
	});
});

// ── detectOutliers ────────────────────────────────────────────────────────────

describe("detectOutliers", () => {
	it("flags empty input entries", () => {
		const entries = [...HEALTHY_ENTRIES, entry("empty", "  ")];
		const outliers = detectOutliers(entries);
		expect(outliers.some((o) => o.id === "empty" && o.reason === "empty_input")).toBe(true);
	});

	it("flags entries with extreme length", () => {
		const long = entry("long", "a ".repeat(5000).trim());
		const entries = [...HEALTHY_ENTRIES, long];
		const outliers = detectOutliers(entries, { extremeLengthZScore: 2.0 });
		expect(outliers.some((o) => o.id === "long" && o.reason === "extreme_length")).toBe(true);
	});

	it("flags missing expected output entries", () => {
		const noExpected = entry("noe", "What is the price?"); // no expectedOutput
		const entries = [...HEALTHY_ENTRIES, noExpected];
		const outliers = detectOutliers(entries);
		expect(outliers.some((o) => o.id === "noe" && o.reason === "missing_expected_output")).toBe(true);
	});

	it("flags low score outliers", () => {
		const lowScorer = entry("low", "Some question", { lastScore: 0.0 });
		const entries = [...HEALTHY_ENTRIES, lowScorer];
		const outliers = detectOutliers(entries, { scoreOutlierZScore: 1.5 });
		expect(outliers.some((o) => o.id === "low" && o.reason === "low_score_outlier")).toBe(true);
	});

	it("returns no outliers for healthy uniform dataset", () => {
		const outliers = detectOutliers(HEALTHY_ENTRIES);
		// Healthy entries have expectedOutput — only check for non-structural outliers
		const structural = outliers.filter((o) => o.reason !== "missing_expected_output");
		expect(structural).toHaveLength(0);
	});
});

// ── detectSchemaDrift ─────────────────────────────────────────────────────────

describe("detectSchemaDrift", () => {
	it("no drift for consistent schema", () => {
		const report = detectSchemaDrift(HEALTHY_ENTRIES);
		// All healthy entries have expectedOutput, tags, lastScore — schema is consistent
		expect(report.anomalousEntryIds.length).toBe(0);
	});

	it("detects drift when schemaVersion differs", () => {
		const mixed = [
			entry("a", "input a", { schemaVersion: "v1" }),
			entry("b", "input b", { schemaVersion: "v2" }),
			entry("c", "input c", { schemaVersion: "v1" }),
			entry("d", "input d", { schemaVersion: "v2" }),
			entry("e", "input e", { schemaVersion: "v1" }),
		];
		const report = detectSchemaDrift(mixed);
		expect(report.driftDetected).toBe(true);
		expect(report.inconsistentFields).toContain("schemaVersion");
	});

	it("returns empty report for empty dataset", () => {
		const report = detectSchemaDrift([]);
		expect(report.driftDetected).toBe(false);
		expect(report.inconsistentFields).toHaveLength(0);
	});

	it("drift ratio is between 0 and 1", () => {
		const report = detectSchemaDrift(HEALTHY_ENTRIES);
		expect(report.driftRatio).toBeGreaterThanOrEqual(0);
		expect(report.driftRatio).toBeLessThanOrEqual(1);
	});
});

// ── computeScoreDistribution ──────────────────────────────────────────────────

describe("computeScoreDistribution", () => {
	it("returns correct mean", () => {
		const dist = computeScoreDistribution(HEALTHY_ENTRIES);
		expect(dist).not.toBeNull();
		const expected = HEALTHY_ENTRIES.map((e) => e.lastScore!).reduce((a, b) => a + b, 0) / HEALTHY_ENTRIES.length;
		expect(dist!.mean).toBeCloseTo(expected, 2);
	});

	it("returns null with fewer than 3 scored entries", () => {
		const small = [entry("a", "x", { lastScore: 0.8 }), entry("b", "y", { lastScore: 0.9 })];
		expect(computeScoreDistribution(small)).toBeNull();
	});

	it("p10 <= median <= p90", () => {
		const dist = computeScoreDistribution(HEALTHY_ENTRIES);
		expect(dist!.p10).toBeLessThanOrEqual(dist!.median);
		expect(dist!.median).toBeLessThanOrEqual(dist!.p90);
	});

	it("lowScoreRatio and highScoreRatio are between 0 and 1", () => {
		const dist = computeScoreDistribution(HEALTHY_ENTRIES);
		expect(dist!.lowScoreRatio).toBeGreaterThanOrEqual(0);
		expect(dist!.lowScoreRatio).toBeLessThanOrEqual(1);
		expect(dist!.highScoreRatio).toBeGreaterThanOrEqual(0);
		expect(dist!.highScoreRatio).toBeLessThanOrEqual(1);
	});

	it("returns null for entries with no scores", () => {
		const unscored = HEALTHY_ENTRIES.map((e) => ({ ...e, lastScore: undefined }));
		expect(computeScoreDistribution(unscored)).toBeNull();
	});
});

// ── analyzeDatasetHealth ──────────────────────────────────────────────────────

describe("analyzeDatasetHealth — small dataset", () => {
	it("returns summary when dataset below minEntries", () => {
		const report = analyzeDatasetHealth([entry("a", "input")], { minEntries: 5 });
		expect(report.totalEntries).toBe(1);
		expect(report.summary).toMatch(/small|minimum/i);
	});

	it("returns healthScore 0 for empty dataset", () => {
		const report = analyzeDatasetHealth([]);
		expect(report.healthScore).toBe(0);
	});
});

describe("analyzeDatasetHealth — healthy dataset", () => {
	it("has healthScore close to 1 for clean dataset", () => {
		const report = analyzeDatasetHealth(HEALTHY_ENTRIES);
		expect(report.healthScore).toBeGreaterThan(0.7);
	});

	it("totalEntries matches input", () => {
		const report = analyzeDatasetHealth(HEALTHY_ENTRIES);
		expect(report.totalEntries).toBe(HEALTHY_ENTRIES.length);
	});

	it("includes score distribution for scored entries", () => {
		const report = analyzeDatasetHealth(HEALTHY_ENTRIES);
		expect(report.scoreDistribution).not.toBeNull();
	});

	it("summary is a non-empty string", () => {
		const report = analyzeDatasetHealth(HEALTHY_ENTRIES);
		expect(report.summary.length).toBeGreaterThan(10);
	});
});

describe("analyzeDatasetHealth — unhealthy dataset", () => {
	it("lower healthScore when duplicates present", () => {
		const withDups = [...HEALTHY_ENTRIES, ...DUPLICATE_ENTRIES];
		const clean = analyzeDatasetHealth(HEALTHY_ENTRIES);
		const dirty = analyzeDatasetHealth(withDups);
		expect(dirty.healthScore).toBeLessThan(clean.healthScore);
	});

	it("includes recommendations when issues found", () => {
		const withDups = [...HEALTHY_ENTRIES, ...DUPLICATE_ENTRIES];
		const report = analyzeDatasetHealth(withDups);
		expect(report.recommendations.length).toBeGreaterThan(0);
	});
});

// ── computeDatasetTrend ───────────────────────────────────────────────────────

describe("computeDatasetTrend", () => {
	const makeReport = (totalEntries: number, meanScore: number, dups: number): DatasetHealthReport => ({
		totalEntries,
		duplicates: Array.from({ length: dups }, (_, i) => ({ idA: `a${i}`, idB: `b${i}`, similarity: 0.99, type: "exact" as const })),
		outliers: [],
		schemaDrift: { driftDetected: false, inconsistentFields: [], anomalousEntryIds: [], driftRatio: 0 },
		scoreDistribution: {
			mean: meanScore, median: meanScore, stdDev: 0.05,
			p10: meanScore - 0.1, p90: meanScore + 0.1,
			lowScoreRatio: 0.05, highScoreRatio: 0.85,
		},
		healthScore: 0.9,
		summary: "test",
		recommendations: [],
	});

	it("detects improving score trend", () => {
		const trend = computeDatasetTrend(makeReport(10, 0.7, 0), makeReport(10, 0.85, 0));
		expect(trend.scoreTrend).toBe("improving");
		expect(trend.meanScoreDelta).toBeCloseTo(0.15);
	});

	it("detects degrading score trend", () => {
		const trend = computeDatasetTrend(makeReport(10, 0.85, 0), makeReport(10, 0.6, 0));
		expect(trend.scoreTrend).toBe("degrading");
	});

	it("detects stable score trend for small delta", () => {
		const trend = computeDatasetTrend(makeReport(10, 0.8, 0), makeReport(10, 0.81, 0));
		expect(trend.scoreTrend).toBe("stable");
	});

	it("detects growing dataset", () => {
		const trend = computeDatasetTrend(makeReport(10, 0.8, 0), makeReport(20, 0.8, 0));
		expect(trend.sizeTrend).toBe("growing");
		expect(trend.sizeDelta).toBe(10);
	});

	it("tracks duplicate delta", () => {
		const trend = computeDatasetTrend(makeReport(10, 0.8, 2), makeReport(10, 0.8, 5));
		expect(trend.duplicateDelta).toBe(3);
	});
});
