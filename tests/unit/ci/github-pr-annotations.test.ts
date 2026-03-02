import { describe, expect, it } from "vitest";
import {
	buildAnnotations,
	buildCheckRunPayload,
	buildPRCommentBody,
	computeEvalDiff,
	deriveConclusion,
	type EvalRunSummary,
	type EvalTestResult,
} from "@/lib/ci/github-pr-annotations";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function result(id: string, passed: boolean, score: number, overrides: Partial<EvalTestResult> = {}): EvalTestResult {
	return {
		testCaseId: id,
		name: `Test ${id}`,
		score,
		passed,
		...overrides,
	};
}

const PASSING_SUMMARY: EvalRunSummary = {
	runId: "run-123",
	evaluationName: "Customer Support Eval",
	totalTests: 10,
	passed: 9,
	failed: 1,
	skipped: 0,
	overallScore: 0.88,
	completedAt: "2025-01-15T12:00:00.000Z",
	results: [
		result("t1", true, 0.92),
		result("t2", true, 0.85),
		result("t3", false, 0.35, { failureReason: "Response too vague", filePath: "evals/support.ts", lineNumber: 42 }),
	],
	baselineScore: 0.85,
	scoreDelta: 0.03,
};

const FAILING_SUMMARY: EvalRunSummary = {
	...PASSING_SUMMARY,
	overallScore: 0.42,
	passed: 4,
	failed: 6,
	scoreDelta: -0.15,
};

const NO_BASELINE_SUMMARY: EvalRunSummary = {
	...PASSING_SUMMARY,
	baselineScore: null,
	scoreDelta: null,
};

// ── deriveConclusion ──────────────────────────────────────────────────────────

describe("deriveConclusion", () => {
	it("success for high score with no regression", () => {
		const allPass = { ...PASSING_SUMMARY, failed: 0, passed: 10 };
		expect(deriveConclusion(allPass)).toBe("success");
	});

	it("failure for score below passThreshold", () => {
		expect(deriveConclusion(FAILING_SUMMARY)).toBe("failure");
	});

	it("failure for significant regression even if score is ok", () => {
		const regressed = { ...PASSING_SUMMARY, overallScore: 0.75, scoreDelta: -0.15 };
		expect(deriveConclusion(regressed)).toBe("failure");
	});

	it("neutral when some failures but overall score passes", () => {
		const neutral = { ...PASSING_SUMMARY, overallScore: 0.72, failed: 2, scoreDelta: 0 };
		expect(deriveConclusion(neutral)).toBe("neutral");
	});

	it("respects custom passThreshold", () => {
		// Use zero failures so neutral branch doesn't fire, only score check
		const noFailures = { ...PASSING_SUMMARY, overallScore: 0.55, failed: 0, scoreDelta: 0 };
		const result = deriveConclusion(noFailures, { passThreshold: 0.5 });
		expect(result).toBe("success");
	});

	it("respects custom regressionThreshold", () => {
		const result = deriveConclusion({ ...PASSING_SUMMARY, scoreDelta: -0.03 }, { regressionThreshold: -0.01 });
		expect(result).toBe("failure");
	});
});

// ── buildAnnotations ──────────────────────────────────────────────────────────

describe("buildAnnotations", () => {
	it("creates annotation for failed test with filePath", () => {
		const annotations = buildAnnotations(PASSING_SUMMARY.results);
		expect(annotations).toHaveLength(1);
		expect(annotations[0]!.path).toBe("evals/support.ts");
		expect(annotations[0]!.startLine).toBe(42);
	});

	it("skips failed tests without filePath", () => {
		const results = [result("a", false, 0.2)]; // no filePath
		expect(buildAnnotations(results)).toHaveLength(0);
	});

	it("uses failure level for very low scores", () => {
		const results = [result("a", false, 0.1, { filePath: "file.ts", lineNumber: 1 })];
		const annotations = buildAnnotations(results);
		expect(annotations[0]!.annotationLevel).toBe("failure");
	});

	it("uses warning level for borderline scores", () => {
		const results = [result("a", false, 0.45, { filePath: "file.ts", lineNumber: 1 })];
		const annotations = buildAnnotations(results);
		expect(annotations[0]!.annotationLevel).toBe("warning");
	});

	it("respects maxAnnotations limit", () => {
		const manyFailed = Array.from({ length: 60 }, (_, i) =>
			result(`t${i}`, false, 0.2, { filePath: `file${i}.ts`, lineNumber: 1 }),
		);
		const annotations = buildAnnotations(manyFailed, { maxAnnotations: 10 });
		expect(annotations).toHaveLength(10);
	});

	it("includes failureReason in annotation message", () => {
		const annotations = buildAnnotations(PASSING_SUMMARY.results);
		expect(annotations[0]!.message).toContain("Response too vague");
	});
});

// ── buildCheckRunPayload ──────────────────────────────────────────────────────

describe("buildCheckRunPayload", () => {
	const SHA = "abc123def456";

	it("uses provided headSha", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(payload.headSha).toBe(SHA);
	});

	it("status is always completed", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(payload.status).toBe("completed");
	});

	it("conclusion matches deriveConclusion", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(payload.conclusion).toBe(deriveConclusion(PASSING_SUMMARY));
	});

	it("output title contains score and counts", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(payload.output.title).toContain("88%");
		expect(payload.output.title).toContain("9/10");
	});

	it("output summary is non-empty string", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(typeof payload.output.summary).toBe("string");
		expect(payload.output.summary.length).toBeGreaterThan(5);
	});

	it("includes annotations when there are failures with file paths", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA);
		expect(payload.output.annotations).toBeDefined();
		expect(payload.output.annotations!.length).toBeGreaterThan(0);
	});

	it("no annotations when all tests pass", () => {
		const allPass = { ...PASSING_SUMMARY, results: [result("a", true, 0.9), result("b", true, 0.85)] };
		const payload = buildCheckRunPayload(allPass, SHA);
		expect(payload.output.annotations).toBeUndefined();
	});

	it("uses custom checkName", () => {
		const payload = buildCheckRunPayload(PASSING_SUMMARY, SHA, { checkName: "MyEvalCI" });
		expect(payload.name).toBe("MyEvalCI");
	});
});

// ── buildPRCommentBody ────────────────────────────────────────────────────────

describe("buildPRCommentBody", () => {
	it("starts with an emoji heading", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toMatch(/^##\s[✅⚠️❌]/);
	});

	it("includes evaluation name in heading", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toContain("Customer Support Eval");
	});

	it("includes score percentage", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toContain("88%");
	});

	it("includes baseline and delta when available", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toContain("85%"); // baseline
		expect(body).toContain("+3.0%"); // delta
	});

	it("does not show baseline section when null", () => {
		const body = buildPRCommentBody(NO_BASELINE_SUMMARY);
		expect(body).not.toContain("Baseline");
	});

	it("includes failed test details by default", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toContain("<details>");
		expect(body).toContain("Test t3");
	});

	it("omits test details when includeTestDetails=false", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY, { includeTestDetails: false });
		expect(body).not.toContain("<details>");
	});

	it("shows failure emoji for failing summary", () => {
		const body = buildPRCommentBody(FAILING_SUMMARY);
		expect(body).toContain("❌");
	});

	it("includes run ID", () => {
		const body = buildPRCommentBody(PASSING_SUMMARY);
		expect(body).toContain("run-123");
	});
});

// ── computeEvalDiff ───────────────────────────────────────────────────────────

describe("computeEvalDiff", () => {
	const prev: EvalTestResult[] = [
		result("t1", true, 0.9),
		result("t2", true, 0.8),
		result("t3", false, 0.3),
		result("t4", true, 0.75),
	];

	const curr: EvalTestResult[] = [
		result("t1", true, 0.97), // improved: 0.9→0.97 = +0.07 > threshold
		result("t2", false, 0.4),  // newly_failing
		result("t3", true, 0.85), // newly_passing
		result("t4", true, 0.74), // stable
	];

	it("detects improved tests", () => {
		const diff = computeEvalDiff(prev, curr);
		const improved = diff.find((d) => d.testCaseId === "t1");
		expect(improved?.status).toBe("improved");
	});

	it("detects newly_failing tests", () => {
		const diff = computeEvalDiff(prev, curr);
		const failing = diff.find((d) => d.testCaseId === "t2");
		expect(failing?.status).toBe("newly_failing");
	});

	it("detects newly_passing tests", () => {
		const diff = computeEvalDiff(prev, curr);
		const passing = diff.find((d) => d.testCaseId === "t3");
		expect(passing?.status).toBe("newly_passing");
	});

	it("detects stable tests", () => {
		const diff = computeEvalDiff(prev, curr);
		const stable = diff.find((d) => d.testCaseId === "t4");
		expect(stable?.status).toBe("stable");
	});

	it("computes correct scoreDelta", () => {
		const diff = computeEvalDiff(prev, curr);
		const t1 = diff.find((d) => d.testCaseId === "t1")!;
		expect(t1.scoreDelta).toBeCloseTo(0.07); // 0.97 - 0.90
	});

	it("skips tests not in previous run", () => {
		const currWithNew = [...curr, result("t5", true, 0.9)];
		const diff = computeEvalDiff(prev, currWithNew);
		expect(diff.find((d) => d.testCaseId === "t5")).toBeUndefined();
	});

	it("sorts by scoreDelta ascending (worst regressions first)", () => {
		const diff = computeEvalDiff(prev, curr);
		for (let i = 1; i < diff.length; i++) {
			expect(diff[i]!.scoreDelta).toBeGreaterThanOrEqual(diff[i - 1]!.scoreDelta);
		}
	});
});
