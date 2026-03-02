import { describe, expect, it, vi } from "vitest";
import {
	bumpReliabilityVersion,
	createReliabilityObject,
	isReliabilityObject,
	RELIABILITY_SPEC_VERSION,
	ReliabilityObjectType,
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
