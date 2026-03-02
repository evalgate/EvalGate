import { describe, expect, it } from "vitest";
import {
	createGeneratedTestCase,
	getGatingCases,
	getPendingReviewCases,
	promoteTestCase,
	type QuarantinedTestCase,
	quarantineTestCase,
	rejectTestCase,
	summarizeQuarantineStatus,
} from "@/lib/testcases/quarantine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function generated(
	id = "tc-1",
	qualityScore: number | null = 0.85,
): QuarantinedTestCase {
	return createGeneratedTestCase({
		id,
		payload: { prompt: "What is 2+2?", expectedOutput: "4" },
		generatedBy: "trace-generator-v1",
		qualityScore,
		tags: ["math"],
	});
}

function quarantined(id = "tc-1"): QuarantinedTestCase {
	const result = quarantineTestCase(generated(id), { actor: "system" });
	if (!result.success) throw new Error("setup failed");
	return result.testCase;
}

function promoted(id = "tc-1"): QuarantinedTestCase {
	const result = promoteTestCase(quarantined(id), {
		actor: "alice",
		reason: "Looks good",
	});
	if (!result.success) throw new Error("setup failed");
	return result.testCase;
}

// ── createGeneratedTestCase ───────────────────────────────────────────────────

describe("createGeneratedTestCase", () => {
	it("creates case with status=generated", () => {
		const tc = generated();
		expect(tc.status).toBe("generated");
	});

	it("starts with empty audit trail", () => {
		expect(generated().auditTrail).toHaveLength(0);
	});

	it("stores qualityScore", () => {
		expect(generated("t", 0.9).qualityScore).toBe(0.9);
	});

	it("defaults qualityScore to null when not provided", () => {
		const tc = createGeneratedTestCase({
			id: "t",
			payload: {},
			generatedBy: "gen",
		});
		expect(tc.qualityScore).toBeNull();
	});

	it("stores tags", () => {
		expect(generated().tags).toContain("math");
	});
});

// ── quarantineTestCase ────────────────────────────────────────────────────────

describe("quarantineTestCase", () => {
	it("transitions generated → quarantined", () => {
		const result = quarantineTestCase(generated());
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("quarantined");
	});

	it("appends audit event", () => {
		const result = quarantineTestCase(generated(), {
			actor: "system",
			reason: "Auto-quarantine",
		});
		expect(result.success).toBe(true);
		expect(result.testCase.auditTrail).toHaveLength(1);
		expect(result.testCase.auditTrail[0]!.action).toBe("quarantined");
		expect(result.testCase.auditTrail[0]!.actor).toBe("system");
	});

	it("is idempotent when already quarantined", () => {
		const q = quarantined();
		const result = quarantineTestCase(q);
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("quarantined");
	});

	it("fails when status is promoted", () => {
		const result = quarantineTestCase(promoted());
		expect(result.success).toBe(false);
		expect(result.reason).toMatch(/promoted/i);
	});

	it("fails when status is rejected", () => {
		const q = quarantined();
		const rej = rejectTestCase(q, {
			actor: "bob",
			reason: "bad case",
		}).testCase;
		const result = quarantineTestCase(rej);
		expect(result.success).toBe(false);
	});
});

// ── promoteTestCase ───────────────────────────────────────────────────────────

describe("promoteTestCase", () => {
	it("transitions quarantined → promoted", () => {
		const result = promoteTestCase(quarantined(), { actor: "alice" });
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("promoted");
	});

	it("appends promote audit event with actor", () => {
		const result = promoteTestCase(quarantined(), {
			actor: "alice",
			reason: "LGTM",
		});
		expect(result.success).toBe(true);
		const last = result.testCase.auditTrail.at(-1)!;
		expect(last.action).toBe("promoted");
		expect(last.actor).toBe("alice");
		expect(last.reason).toBe("LGTM");
	});

	it("is idempotent when already promoted", () => {
		const p = promoted();
		const result = promoteTestCase(p, { actor: "bob" });
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("promoted");
	});

	it("fails when status is generated (must quarantine first)", () => {
		const result = promoteTestCase(generated(), { actor: "alice" });
		expect(result.success).toBe(false);
		expect(result.reason).toMatch(/quarantined/i);
	});

	it("fails when status is rejected", () => {
		const q = quarantined();
		const rej = rejectTestCase(q, { actor: "bob", reason: "bad" }).testCase;
		const result = promoteTestCase(rej, { actor: "alice" });
		expect(result.success).toBe(false);
	});

	it("fails when quality score is below minimum", () => {
		const lowQuality = quarantined();
		const tcWithLowScore: QuarantinedTestCase = {
			...lowQuality,
			qualityScore: 0.3,
		};
		const result = promoteTestCase(tcWithLowScore, {
			actor: "alice",
			minQualityScore: 0.6,
		});
		expect(result.success).toBe(false);
		expect(result.reason).toMatch(/quality score/i);
	});

	it("passes when quality score meets minimum", () => {
		const q = quarantined();
		const tcWithScore: QuarantinedTestCase = { ...q, qualityScore: 0.75 };
		const result = promoteTestCase(tcWithScore, {
			actor: "alice",
			minQualityScore: 0.6,
		});
		expect(result.success).toBe(true);
	});

	it("ignores min quality score when qualityScore is null", () => {
		const q = quarantined();
		const noScore: QuarantinedTestCase = { ...q, qualityScore: null };
		const result = promoteTestCase(noScore, {
			actor: "alice",
			minQualityScore: 0.8,
		});
		expect(result.success).toBe(true);
	});
});

// ── rejectTestCase ────────────────────────────────────────────────────────────

describe("rejectTestCase", () => {
	it("transitions quarantined → rejected", () => {
		const result = rejectTestCase(quarantined(), {
			actor: "bob",
			reason: "Flaky test",
		});
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("rejected");
	});

	it("appends reject audit event", () => {
		const result = rejectTestCase(quarantined(), {
			actor: "bob",
			reason: "Flaky test",
		});
		const last = result.testCase.auditTrail.at(-1)!;
		expect(last.action).toBe("rejected");
		expect(last.actor).toBe("bob");
		expect(last.reason).toBe("Flaky test");
	});

	it("is idempotent when already rejected", () => {
		const q = quarantined();
		const rej = rejectTestCase(q, { actor: "bob", reason: "bad" }).testCase;
		const result = rejectTestCase(rej, { actor: "carol", reason: "still bad" });
		expect(result.success).toBe(true);
		expect(result.testCase.status).toBe("rejected");
	});

	it("fails when status is promoted", () => {
		const result = rejectTestCase(promoted(), {
			actor: "bob",
			reason: "changed mind",
		});
		expect(result.success).toBe(false);
		expect(result.reason).toMatch(/demote/i);
	});

	it("can reject a generated case", () => {
		const result = rejectTestCase(generated(), {
			actor: "bob",
			reason: "garbage",
		});
		expect(result.success).toBe(true);
	});
});

// ── getGatingCases ────────────────────────────────────────────────────────────

describe("getGatingCases", () => {
	it("returns only promoted cases", () => {
		const cases = [
			generated("g"),
			quarantined("q"),
			promoted("p"),
			rejectTestCase(quarantined("r"), { actor: "x", reason: "bad" }).testCase,
		];
		const gating = getGatingCases(cases);
		expect(gating).toHaveLength(1);
		expect(gating[0]!.id).toBe("p");
	});

	it("returns empty array when no promoted cases", () => {
		expect(getGatingCases([generated(), quarantined()])).toHaveLength(0);
	});
});

// ── getPendingReviewCases ─────────────────────────────────────────────────────

describe("getPendingReviewCases", () => {
	it("returns generated and quarantined cases", () => {
		const cases = [generated("g"), quarantined("q"), promoted("p")];
		const pending = getPendingReviewCases(cases);
		expect(pending).toHaveLength(2);
		expect(pending.map((c) => c.id)).toContain("g");
		expect(pending.map((c) => c.id)).toContain("q");
	});
});

// ── summarizeQuarantineStatus ─────────────────────────────────────────────────

describe("summarizeQuarantineStatus", () => {
	it("counts cases by status", () => {
		const cases = [
			generated("g"),
			quarantined("q"),
			promoted("p1"),
			promoted("p2"),
		];
		const stats = summarizeQuarantineStatus(cases);
		expect(stats.total).toBe(4);
		expect(stats.byStatus.generated).toBe(1);
		expect(stats.byStatus.quarantined).toBe(1);
		expect(stats.byStatus.promoted).toBe(2);
		expect(stats.byStatus.rejected).toBe(0);
	});

	it("tracks promotedBy actor", () => {
		const p1 = promoteTestCase(quarantined("tc1"), { actor: "alice" }).testCase;
		const p2 = promoteTestCase(quarantined("tc2"), { actor: "alice" }).testCase;
		const stats = summarizeQuarantineStatus([p1, p2]);
		expect(stats.promotedBy.alice).toBe(2);
	});

	it("tracks rejectedBy actor", () => {
		const r = rejectTestCase(quarantined(), {
			actor: "bob",
			reason: "bad",
		}).testCase;
		const stats = summarizeQuarantineStatus([r]);
		expect(stats.rejectedBy.bob).toBe(1);
	});

	it("returns zeros for empty input", () => {
		const stats = summarizeQuarantineStatus([]);
		expect(stats.total).toBe(0);
		expect(Object.keys(stats.promotedBy)).toHaveLength(0);
	});
});
