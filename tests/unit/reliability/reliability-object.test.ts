import { describe, expect, it } from "vitest";
import {
	buildVersionHistory,
	bumpReliabilityVersion,
	createReliabilityObject,
	isReliabilityObject,
	RELIABILITY_SPEC_VERSION,
	ReliabilityObjectType,
	resolveAtTime,
	resolveAtVersion,
} from "@/lib/reliability/reliability-object";

describe("createReliabilityObject", () => {
	it("creates a v1 object with correct defaults", () => {
		const obj = createReliabilityObject({
			id: "trace-abc",
			type: ReliabilityObjectType.TRACE,
			source: "trace.service",
		});

		expect(obj.id).toBe("trace-abc");
		expect(obj.type).toBe("trace");
		expect(obj.version).toBe(1);
		expect(obj.parentVersion).toBeNull();
		expect(obj.createdFrom).toBeNull();
		expect(obj.specVersion).toBe(RELIABILITY_SPEC_VERSION);
		expect(obj.provenance.source).toBe("trace.service");
		expect(obj.provenance.actorId).toBeNull();
	});

	it("includes optional fields when provided", () => {
		const obj = createReliabilityObject({
			id: "metric-1",
			type: ReliabilityObjectType.METRIC,
			source: "metric.service",
			actorId: "user-42",
			createdFrom: "run-99",
			reason: "initial creation",
			requestId: "req-abc",
		});

		expect(obj.provenance.actorId).toBe("user-42");
		expect(obj.createdFrom).toBe("run-99");
		expect(obj.provenance.reason).toBe("initial creation");
		expect(obj.provenance.requestId).toBe("req-abc");
	});

	it("sets a valid ISO createdAt timestamp", () => {
		const before = Date.now();
		const obj = createReliabilityObject({
			id: "x",
			type: ReliabilityObjectType.BASELINE,
			source: "test",
		});
		const after = Date.now();

		const ts = new Date(obj.provenance.createdAt).getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});

describe("bumpReliabilityVersion", () => {
	it("increments version and sets parentVersion", () => {
		const v1 = createReliabilityObject({
			id: "judge-1",
			type: ReliabilityObjectType.JUDGE,
			source: "judge.service",
		});

		const v2 = bumpReliabilityVersion(v1, {
			source: "judge.service",
			reason: "prompt updated",
		});

		expect(v2.version).toBe(2);
		expect(v2.parentVersion).toBe(1);
		expect(v2.id).toBe(v1.id);
		expect(v2.type).toBe(v1.type);
		expect(v2.provenance.reason).toBe("prompt updated");
	});

	it("can chain multiple bumps", () => {
		let obj = createReliabilityObject({
			id: "ds-1",
			type: ReliabilityObjectType.DATASET,
			source: "dataset.service",
		});

		for (let i = 0; i < 5; i++) {
			obj = bumpReliabilityVersion(obj, { source: "test" });
		}

		expect(obj.version).toBe(6);
		expect(obj.parentVersion).toBe(5);
	});

	it("preserves id, type, createdFrom across bumps", () => {
		const v1 = createReliabilityObject({
			id: "failure-99",
			type: ReliabilityObjectType.FAILURE,
			source: "debug.service",
			createdFrom: "trace-xyz",
		});

		const v2 = bumpReliabilityVersion(v1, { source: "debug.service" });

		expect(v2.id).toBe("failure-99");
		expect(v2.type).toBe(ReliabilityObjectType.FAILURE);
		expect(v2.createdFrom).toBe("trace-xyz");
	});
});

describe("isReliabilityObject", () => {
	it("returns true for a valid ReliabilityObject", () => {
		const obj = createReliabilityObject({
			id: "x",
			type: ReliabilityObjectType.TRACE,
			source: "test",
		});
		expect(isReliabilityObject(obj)).toBe(true);
	});

	it("returns false for null / primitives", () => {
		expect(isReliabilityObject(null)).toBe(false);
		expect(isReliabilityObject(undefined)).toBe(false);
		expect(isReliabilityObject("string")).toBe(false);
		expect(isReliabilityObject(42)).toBe(false);
	});

	it("returns false for objects missing required fields", () => {
		expect(isReliabilityObject({ id: "x" })).toBe(false);
		expect(isReliabilityObject({ id: "x", type: "trace" })).toBe(false);
		expect(isReliabilityObject({ id: "x", type: "trace", version: 1 })).toBe(
			false,
		);
	});
});

// ── Helpers for version-resolution tests ──────────────────────────────────────

function buildHistory(count: number) {
	let obj = createReliabilityObject({
		id: "metric-1",
		type: ReliabilityObjectType.METRIC,
		source: "test",
	});
	const history = [obj];
	for (let i = 1; i < count; i++) {
		obj = bumpReliabilityVersion(obj, { source: "test" });
		history.push(obj);
	}
	return history;
}

// ── resolveAtVersion ──────────────────────────────────────────────────────────

describe("resolveAtVersion", () => {
	it("returns the object at the exact version", () => {
		const history = buildHistory(4);
		const v2 = resolveAtVersion(history, 2);
		expect(v2).not.toBeNull();
		expect(v2!.version).toBe(2);
	});

	it("returns latest version when requesting highest", () => {
		const history = buildHistory(3);
		expect(resolveAtVersion(history, 3)!.version).toBe(3);
	});

	it("returns null for a version that does not exist", () => {
		const history = buildHistory(2);
		expect(resolveAtVersion(history, 99)).toBeNull();
	});

	it("returns null for empty history", () => {
		expect(resolveAtVersion([], 1)).toBeNull();
	});

	it("works with out-of-order history array", () => {
		const history = buildHistory(3).reverse();
		expect(resolveAtVersion(history, 1)!.version).toBe(1);
	});
});

// ── resolveAtTime ─────────────────────────────────────────────────────────────

describe("resolveAtTime", () => {
	it("returns latest version at or before the given timestamp", () => {
		const history = buildHistory(3);
		// All versions were created in the past — use a far-future timestamp
		const result = resolveAtTime(history, "2099-01-01T00:00:00.000Z");
		expect(result).not.toBeNull();
		expect(result!.version).toBe(3);
	});

	it("returns null when cutoff is before all versions", () => {
		const history = buildHistory(2);
		const result = resolveAtTime(history, "2000-01-01T00:00:00.000Z");
		expect(result).toBeNull();
	});

	it("returns null for invalid timestamp", () => {
		const history = buildHistory(2);
		expect(resolveAtTime(history, "not-a-date")).toBeNull();
	});

	it("returns null for empty history", () => {
		expect(resolveAtTime([], "2099-01-01T00:00:00.000Z")).toBeNull();
	});
});

// ── buildVersionHistory ───────────────────────────────────────────────────────

describe("buildVersionHistory", () => {
	it("sorts unsorted versions in ascending order", () => {
		const history = buildHistory(3).reverse(); // v3, v2, v1
		const result = buildVersionHistory(history);
		expect(result.valid).toBe(true);
		expect(result.history.map((o) => o.version)).toEqual([1, 2, 3]);
	});

	it("returns valid=true for empty input", () => {
		const result = buildVersionHistory([]);
		expect(result.valid).toBe(true);
		expect(result.history).toHaveLength(0);
	});

	it("returns valid=false when objects have mixed ids", () => {
		const h1 = buildHistory(1);
		const h2 = [createReliabilityObject({ id: "other-id", type: ReliabilityObjectType.METRIC, source: "test" })];
		const result = buildVersionHistory([...h1, ...h2]);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/Mixed ids/i);
	});

	it("returns valid=false when version sequence has a gap", () => {
		const history = buildHistory(3);
		// Remove v2 to create a gap: v1, v3
		const gapped = history.filter((o) => o.version !== 2);
		const result = buildVersionHistory(gapped);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/gap/i);
	});

	it("returns valid=false for mixed types", () => {
		const v1 = createReliabilityObject({ id: "e1", type: ReliabilityObjectType.TRACE, source: "s" });
		const v2bumped = { ...bumpReliabilityVersion(v1, { source: "s" }), type: ReliabilityObjectType.DATASET } as typeof v1;
		const result = buildVersionHistory([v1, v2bumped]);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/Mixed types/i);
	});
});
