/**
 * Determinism Tests
 *
 * Verify that identical inputs always produce identical outputs.
 * This is core to the platform's brand — evaluations must be reproducible.
 *
 * Covers:
 * - Export hash stability (same payload → same SHA-256)
 * - Input normalization idempotency
 * - Stable stringify key-order independence
 * - Quality score determinism (same stats → same grade)
 */

import { describe, expect, it } from "vitest";
import {
	calculateQualityScore,
	type EvaluationStats,
} from "@/lib/ai-quality-score";
import { computeExportHash } from "@/lib/shared-exports/hash";
import { stableStringify } from "@/lib/shared-exports/stable-stringify";
import { computeEvalCaseId } from "@/lib/testcases/spec";
import { normalizeInput, sha256Input } from "@/lib/utils/input-hash";

// ── Export Hash Determinism ──

describe("Export hash determinism", () => {
	const payload = {
		evaluation: { id: "1", name: "Test", description: "", type: "unit_test" },
		timestamp: "2025-01-01T00:00:00.000Z",
		summary: { totalTests: 10, passed: 8, failed: 2, passRate: "80%" },
	};

	it("produces identical hash for identical payload", () => {
		const hash1 = computeExportHash(payload);
		const hash2 = computeExportHash(payload);
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^[a-f0-9]{64}$/); // valid SHA-256 hex
	});

	it("produces identical hash regardless of key order", () => {
		const reordered = {
			summary: payload.summary,
			timestamp: payload.timestamp,
			evaluation: payload.evaluation,
		};
		expect(computeExportHash(reordered)).toBe(computeExportHash(payload));
	});

	it("produces different hash for different payload", () => {
		const altered = { ...payload, timestamp: "2025-02-01T00:00:00.000Z" };
		expect(computeExportHash(altered)).not.toBe(computeExportHash(payload));
	});

	it("handles nested key reordering", () => {
		const a = { evaluation: { name: "X", id: "1" }, timestamp: "t" };
		const b = { evaluation: { id: "1", name: "X" }, timestamp: "t" };
		expect(computeExportHash(a)).toBe(computeExportHash(b));
	});
});

// ── Stable Stringify ──

describe("Stable stringify", () => {
	it("is idempotent — stringify(parse(stringify(x))) === stringify(x)", () => {
		const obj = { z: 1, a: { y: 2, b: 3 }, m: [3, 1, 2] };
		const first = stableStringify(obj);
		const roundTripped = stableStringify(JSON.parse(first));
		expect(roundTripped).toBe(first);
	});

	it("handles null, undefined, booleans, numbers", () => {
		expect(stableStringify(null)).toBe("null");
		expect(stableStringify(42)).toBe("42");
		expect(stableStringify(true)).toBe("true");
		expect(stableStringify("hello")).toBe('"hello"');
	});

	it("preserves array order (arrays are NOT sorted)", () => {
		const a = stableStringify([3, 1, 2]);
		expect(a).toBe("[3,1,2]");
	});
});

// ── Input Normalization ──

describe("Input normalization determinism", () => {
	it("normalizes whitespace consistently", () => {
		const a = normalizeInput("  hello   world  ");
		const b = normalizeInput("hello world");
		expect(a).toBe(b);
	});

	it("normalizes JSON key order", () => {
		const a = normalizeInput('{"b": 2, "a": 1}');
		const b = normalizeInput('{"a": 1, "b": 2}');
		expect(a).toBe(b);
	});

	it("produces identical SHA-256 for equivalent inputs", () => {
		const hash1 = sha256Input('{"b": 2, "a": 1}');
		const hash2 = sha256Input('{"a": 1, "b": 2}');
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces different SHA-256 for different inputs", () => {
		expect(sha256Input("input A")).not.toBe(sha256Input("input B"));
	});

	it("is idempotent — normalizing twice yields same result", () => {
		const input = '  {"z": 1, "a": 2}  ';
		expect(normalizeInput(normalizeInput(input))).toBe(normalizeInput(input));
	});
});

// ── EvalCase ID Determinism ──

describe("EvalCase ID determinism", () => {
	it("same inputs always produce the same ID", () => {
		const id1 = computeEvalCaseId({
			title: "refund partial payment",
			tags: ["billing"],
		});
		const id2 = computeEvalCaseId({
			title: "refund partial payment",
			tags: ["billing"],
		});
		expect(id1).toBe(id2);
	});

	it("IDs are in the expected format (ec_ + 16 hex chars)", () => {
		const id = computeEvalCaseId({ title: "test case" });
		expect(id).toMatch(/^ec_[0-9a-f]{16}$/);
	});

	it("tag order does not affect ID", () => {
		const a = computeEvalCaseId({ title: "t", tags: ["z", "a"] });
		const b = computeEvalCaseId({ title: "t", tags: ["a", "z"] });
		expect(a).toBe(b);
	});

	it("different titles produce different IDs", () => {
		const a = computeEvalCaseId({ title: "case A" });
		const b = computeEvalCaseId({ title: "case B" });
		expect(a).not.toBe(b);
	});
});

// ── Quality Score Determinism ──

describe("Quality score determinism", () => {
	const stats: EvaluationStats = {
		totalEvaluations: 100,
		passedEvaluations: 85,
		failedEvaluations: 15,
		averageLatency: 500,
		averageCost: 0.01,
		averageScore: 85,
		consistencyScore: 90,
	};

	it("same stats → same grade and overall score", () => {
		const score1 = calculateQualityScore(stats);
		const score2 = calculateQualityScore(stats);
		expect(score1.overall).toBe(score2.overall);
		expect(score1.grade).toBe(score2.grade);
		expect(score1.metrics).toEqual(score2.metrics);
	});

	it("run A === run B — full deep equality", () => {
		const a = calculateQualityScore(stats);
		const b = calculateQualityScore(stats);
		expect(a).toEqual(b);
	});
});
