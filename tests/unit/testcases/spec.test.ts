import { describe, expect, it } from "vitest";
import {
	computeEvalCaseId,
	createEvalCase,
	EVAL_CASE_VERSION,
	EvalCaseSchema,
	parseEvalCase,
	roundTripEvalCase,
	serializeEvalCase,
} from "@/lib/testcases/spec";

describe("computeEvalCaseId", () => {
	it("produces a string starting with ec_", () => {
		const id = computeEvalCaseId({ title: "test case" });
		expect(id).toMatch(/^ec_[0-9a-f]{16}$/);
	});

	it("is deterministic for the same input", () => {
		const id1 = computeEvalCaseId({ title: "my test", tags: ["a", "b"] });
		const id2 = computeEvalCaseId({ title: "my test", tags: ["a", "b"] });
		expect(id1).toBe(id2);
	});

	it("is tag-order independent", () => {
		const id1 = computeEvalCaseId({ title: "test", tags: ["b", "a"] });
		const id2 = computeEvalCaseId({ title: "test", tags: ["a", "b"] });
		expect(id1).toBe(id2);
	});

	it("is sourceTraceId-order independent", () => {
		const id1 = computeEvalCaseId({ title: "t", sourceTraceIds: ["z", "a"] });
		const id2 = computeEvalCaseId({ title: "t", sourceTraceIds: ["a", "z"] });
		expect(id1).toBe(id2);
	});

	it("differs for different titles", () => {
		const id1 = computeEvalCaseId({ title: "case A" });
		const id2 = computeEvalCaseId({ title: "case B" });
		expect(id1).not.toBe(id2);
	});

	it("is case-insensitive for title", () => {
		const id1 = computeEvalCaseId({ title: "My Test" });
		const id2 = computeEvalCaseId({ title: "my test" });
		expect(id1).toBe(id2);
	});
});

describe("createEvalCase", () => {
	it("creates an eval case with correct defaults", () => {
		const ec = createEvalCase({ title: "Basic case" });

		expect(ec.id).toMatch(/^ec_/);
		expect(ec.evalCaseVersion).toBe(EVAL_CASE_VERSION);
		expect(ec.title).toBe("Basic case");
		expect(ec.tags).toHaveLength(0);
		expect(ec.sourceTraceIds).toHaveLength(0);
		expect(ec.frozenSnapshotRef).toBeNull();
		expect(ec.quarantined).toBe(true); // default quarantined
		expect(ec.mergedFromIds).toHaveLength(0);
	});

	it("sets tags and sourceTraceIds", () => {
		const ec = createEvalCase({
			title: "Tagged case",
			tags: ["refund", "edge-case"],
			sourceTraceIds: ["trace-1", "trace-2"],
		});

		expect(ec.tags).toContain("refund");
		expect(ec.sourceTraceIds).toContain("trace-1");
	});

	it("accepts all optional refs", () => {
		const ec = createEvalCase({
			title: "Full case",
			frozenSnapshotRef: "snap-abc",
			rubricRef: "rubric-1",
			metricDAGRef: "dag-2",
			replayTier: "A",
			redactionProfileRef: "default",
		});

		expect(ec.frozenSnapshotRef).toBe("snap-abc");
		expect(ec.rubricRef).toBe("rubric-1");
		expect(ec.replayTier).toBe("A");
	});

	it("accepts expected constraints", () => {
		const ec = createEvalCase({
			title: "Constrained case",
			expectedConstraints: [
				{ type: "contains", value: "refund", required: true },
				{ type: "score_gte", value: 0.8, required: true },
			],
		});

		expect(ec.expectedConstraints).toHaveLength(2);
		expect(ec.expectedConstraints[0]!.type).toBe("contains");
	});

	it("has a valid ISO createdAt", () => {
		const ec = createEvalCase({ title: "t" });
		expect(() => new Date(ec.createdAt)).not.toThrow();
		expect(new Date(ec.createdAt).getTime()).toBeGreaterThan(0);
	});
});

describe("serializeEvalCase / parseEvalCase", () => {
	it("serializes to valid JSON", () => {
		const ec = createEvalCase({ title: "serialize test" });
		const json = serializeEvalCase(ec);
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it("parseEvalCase succeeds for valid input", () => {
		const ec = createEvalCase({ title: "parse test" });
		const json = serializeEvalCase(ec);
		const result = parseEvalCase(JSON.parse(json));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe(ec.id);
		}
	});

	it("parseEvalCase fails for invalid input", () => {
		const result = parseEvalCase({ title: 123, missingId: true });
		expect(result.success).toBe(false);
	});
});

describe("roundTripEvalCase", () => {
	it("produces stable round-trip for a complete case", () => {
		const ec = createEvalCase({
			title: "Round trip test",
			tags: ["smoke"],
			sourceTraceIds: ["trace-99"],
			replayTier: "B",
		});

		const result = roundTripEvalCase(ec);
		expect(result.stable).toBe(true);
		expect(result.reparsed?.id).toBe(ec.id);
		expect(result.reparsed?.title).toBe(ec.title);
	});

	it("round-trip preserves all fields", () => {
		const ec = createEvalCase({
			title: "Full round trip",
			tags: ["a", "b"],
			sourceTraceIds: ["t-1"],
			frozenSnapshotRef: "snap-1",
			replayTier: "A",
			expectedConstraints: [
				{ type: "contains", value: "hello", required: true },
			],
		});

		const result = roundTripEvalCase(ec);
		expect(result.stable).toBe(true);
		expect(result.reparsed?.expectedConstraints).toHaveLength(1);
	});
});

describe("EvalCaseSchema validation", () => {
	it("rejects missing title", () => {
		const result = EvalCaseSchema.safeParse({
			id: "ec_abc",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		expect(result.success).toBe(false);
	});

	it("accepts valid replayTier values", () => {
		const now = new Date().toISOString();
		for (const tier of ["A", "B", "C"]) {
			const result = EvalCaseSchema.safeParse({
				id: "ec_abc",
				title: "test",
				replayTier: tier,
				createdAt: now,
				updatedAt: now,
			});
			expect(result.success).toBe(true);
		}
	});
});
