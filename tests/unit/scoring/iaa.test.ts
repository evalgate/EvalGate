import { describe, expect, it } from "vitest";
import {
	type AnnotationRecord,
	cohensKappa,
	computeIAA,
	fleissKappa,
} from "@/lib/iaa/index";

// ── cohensKappa ───────────────────────────────────────────────────────────────

describe("cohensKappa", () => {
	it("returns 1 for perfect agreement", () => {
		const pairs = [
			{ rater1: "yes", rater2: "yes" },
			{ rater1: "no", rater2: "no" },
			{ rater1: "yes", rater2: "yes" },
		];
		expect(cohensKappa(pairs)).toBeCloseTo(1.0);
	});

	it("returns 0 for random agreement (no better than chance)", () => {
		// Perfect disagreement on balanced binary → kappa near -1
		const pairs = [
			{ rater1: "yes", rater2: "no" },
			{ rater1: "no", rater2: "yes" },
			{ rater1: "yes", rater2: "no" },
			{ rater1: "no", rater2: "yes" },
		];
		const k = cohensKappa(pairs);
		expect(k).toBeLessThan(0);
	});

	it("returns 0 for empty pairs", () => {
		expect(cohensKappa([])).toBe(0);
	});

	it("returns value in [-1, 1]", () => {
		const pairs = [
			{ rater1: "a", rater2: "b" },
			{ rater1: "a", rater2: "a" },
			{ rater1: "b", rater2: "b" },
			{ rater1: "b", rater2: "a" },
		];
		const k = cohensKappa(pairs);
		expect(k).toBeGreaterThanOrEqual(-1);
		expect(k).toBeLessThanOrEqual(1);
	});

	it("handles numeric category values", () => {
		const pairs = [
			{ rater1: 1, rater2: 1 },
			{ rater1: 2, rater2: 2 },
			{ rater1: 1, rater2: 1 },
		];
		expect(cohensKappa(pairs)).toBeCloseTo(1.0);
	});

	it("returns positive kappa for substantial agreement", () => {
		const pairs = [
			{ rater1: "yes", rater2: "yes" },
			{ rater1: "yes", rater2: "yes" },
			{ rater1: "no", rater2: "no" },
			{ rater1: "yes", rater2: "yes" },
			{ rater1: "no", rater2: "yes" }, // one disagreement
		];
		expect(cohensKappa(pairs)).toBeGreaterThan(0.5);
	});
});

// ── fleissKappa ───────────────────────────────────────────────────────────────

describe("fleissKappa", () => {
	it("returns 1 for perfect agreement across all raters", () => {
		// 3 items, 3 raters each, all agree
		const matrix = [
			{ yes: 3 }, // all 3 raters said "yes"
			{ no: 3 },
			{ yes: 3 },
		];
		expect(fleissKappa(matrix)).toBeCloseTo(1.0);
	});

	it("returns 0 for empty matrix", () => {
		expect(fleissKappa([])).toBe(0);
	});

	it("returns 0 for single rater per item", () => {
		const matrix = [{ yes: 1 }, { no: 1 }];
		expect(fleissKappa(matrix)).toBe(0);
	});

	it("returns value in [-1, 1]", () => {
		const matrix = [
			{ yes: 2, no: 1 },
			{ yes: 1, no: 2 },
			{ yes: 2, no: 1 },
		];
		const k = fleissKappa(matrix);
		expect(k).toBeGreaterThanOrEqual(-1);
		expect(k).toBeLessThanOrEqual(1);
	});

	it("returns positive kappa for good agreement", () => {
		const matrix = [
			{ yes: 3, no: 0 },
			{ yes: 0, no: 3 },
			{ yes: 3, no: 0 },
			{ yes: 3, no: 0 },
		];
		expect(fleissKappa(matrix)).toBeGreaterThan(0.5);
	});
});

// ── computeIAA ────────────────────────────────────────────────────────────────

function ann(
	itemId: string,
	annotatorId: string,
	category: string,
): AnnotationRecord {
	return { itemId, annotatorId, category };
}

describe("computeIAA — basic", () => {
	it("returns zero counts for empty annotations", () => {
		const result = computeIAA([]);
		expect(result.itemCount).toBe(0);
		expect(result.annotatorCount).toBe(0);
		expect(result.agreementPercentage).toBe(0);
	});

	it("returns zero counts when no item has 2+ annotations", () => {
		const result = computeIAA([
			ann("item1", "a1", "yes"),
			ann("item2", "a2", "no"),
		]);
		expect(result.itemCount).toBe(0);
	});

	it("counts unique annotators", () => {
		const result = computeIAA([
			ann("item1", "alice", "yes"),
			ann("item1", "bob", "yes"),
		]);
		expect(result.annotatorCount).toBe(2);
	});

	it("counts items with 2+ annotations", () => {
		const result = computeIAA([
			ann("item1", "alice", "yes"),
			ann("item1", "bob", "yes"),
			ann("item2", "alice", "no"),
			ann("item2", "bob", "no"),
		]);
		expect(result.itemCount).toBe(2);
	});
});

describe("computeIAA — agreement percentage", () => {
	it("returns 1 (100%) for perfect agreement", () => {
		const result = computeIAA([
			ann("i1", "a", "yes"),
			ann("i1", "b", "yes"),
			ann("i2", "a", "no"),
			ann("i2", "b", "no"),
		]);
		expect(result.agreementPercentage).toBe(1);
	});

	it("returns 0 for complete disagreement", () => {
		const result = computeIAA([ann("i1", "a", "yes"), ann("i1", "b", "no")]);
		expect(result.agreementPercentage).toBe(0);
	});

	it("returns fractional agreement for partial matches", () => {
		const result = computeIAA([
			ann("i1", "a", "yes"),
			ann("i1", "b", "yes"), // agree
			ann("i2", "a", "yes"),
			ann("i2", "b", "no"), // disagree
		]);
		expect(result.agreementPercentage).toBe(0.5);
	});
});

describe("computeIAA — Cohen's Kappa for 2 annotators", () => {
	it("computes cohensKappa for exactly 2 annotators", () => {
		const result = computeIAA([
			ann("i1", "alice", "yes"),
			ann("i1", "bob", "yes"),
			ann("i2", "alice", "no"),
			ann("i2", "bob", "no"),
			ann("i3", "alice", "yes"),
			ann("i3", "bob", "yes"),
		]);
		expect(result.cohensKappa).toBeDefined();
		expect(result.cohensKappa).toBeCloseTo(1.0);
		expect(result.fleissKappa).toBeUndefined();
	});

	it("returns positive kappa for substantial 2-rater agreement", () => {
		const result = computeIAA([
			ann("i1", "a", "yes"),
			ann("i1", "b", "yes"),
			ann("i2", "a", "no"),
			ann("i2", "b", "no"),
			ann("i3", "a", "yes"),
			ann("i3", "b", "yes"),
			ann("i4", "a", "no"),
			ann("i4", "b", "yes"), // one mismatch
		]);
		expect(result.cohensKappa).toBeDefined();
		expect(result.cohensKappa!).toBeGreaterThanOrEqual(0.5);
	});
});

describe("computeIAA — Fleiss's Kappa for 3+ annotators", () => {
	it("computes fleissKappa for 3+ annotators", () => {
		const result = computeIAA([
			ann("i1", "alice", "yes"),
			ann("i1", "bob", "yes"),
			ann("i1", "carol", "yes"),
			ann("i2", "alice", "no"),
			ann("i2", "bob", "no"),
			ann("i2", "carol", "no"),
		]);
		expect(result.fleissKappa).toBeDefined();
		expect(result.fleissKappa).toBeCloseTo(1.0);
		expect(result.cohensKappa).toBeUndefined();
	});

	it("returns positive fleissKappa for good 3-way agreement", () => {
		const result = computeIAA([
			ann("i1", "a", "yes"),
			ann("i1", "b", "yes"),
			ann("i1", "c", "yes"),
			ann("i2", "a", "no"),
			ann("i2", "b", "no"),
			ann("i2", "c", "no"),
			ann("i3", "a", "yes"),
			ann("i3", "b", "yes"),
			ann("i3", "c", "no"), // partial
		]);
		expect(result.fleissKappa).toBeDefined();
		expect(result.fleissKappa!).toBeGreaterThan(0);
	});
});

describe("computeIAA — edge cases", () => {
	it("ignores annotations with empty category", () => {
		const result = computeIAA([
			{ itemId: "i1", annotatorId: "a", category: "" },
			{ itemId: "i1", annotatorId: "b", category: "yes" },
		]);
		// Only "b" has a valid category → single annotation → itemCount=0
		expect(result.itemCount).toBe(0);
	});

	it("handles numeric categories", () => {
		// Need at least 2 distinct categories so p_e < 1 → kappa is defined
		const result = computeIAA([
			{ itemId: "i1", annotatorId: "a", category: 1 },
			{ itemId: "i1", annotatorId: "b", category: 1 },
			{ itemId: "i2", annotatorId: "a", category: 2 },
			{ itemId: "i2", annotatorId: "b", category: 2 },
		]);
		expect(result.agreementPercentage).toBe(1);
		expect(result.cohensKappa).toBeCloseTo(1.0);
	});
});
