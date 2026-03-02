import { describe, expect, it } from "vitest";
import {
	SDKAssertionResultSchema,
	SDKEvaluationResultSchema,
	SDKMessageSchema,
	SDKTestResultSchema,
	SDKToolCallSchema,
	SDKTraceSchema,
	SDKTraceSpanSchema,
	validateSDKEvaluationResult,
	validateSDKTestResult,
	validateSDKTrace,
} from "@/lib/sdk/mapper";

// ── SDKAssertionResultSchema ──────────────────────────────────────────────────

describe("SDKAssertionResultSchema", () => {
	it("accepts a minimal valid assertion", () => {
		const result = SDKAssertionResultSchema.safeParse({
			key: "no_pii",
			category: "privacy",
			passed: true,
		});
		expect(result.success).toBe(true);
	});

	it("accepts all optional fields", () => {
		const result = SDKAssertionResultSchema.safeParse({
			key: "toxicity",
			category: "safety",
			passed: false,
			score: 0.2,
			severity: "high",
			details: "Found toxic keyword",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid category", () => {
		const result = SDKAssertionResultSchema.safeParse({
			key: "x",
			category: "unknown_category",
			passed: true,
		});
		expect(result.success).toBe(false);
	});

	it("rejects score outside 0-1", () => {
		const result = SDKAssertionResultSchema.safeParse({
			key: "x",
			category: "quality",
			passed: true,
			score: 1.5,
		});
		expect(result.success).toBe(false);
	});
});

// ── SDKMessageSchema ──────────────────────────────────────────────────────────

describe("SDKMessageSchema", () => {
	it("accepts all valid roles", () => {
		for (const role of ["system", "user", "assistant", "tool", "function_call", "function_result"]) {
			const result = SDKMessageSchema.safeParse({ role, content: "hello" });
			expect(result.success, `role ${role} should be valid`).toBe(true);
		}
	});

	it("rejects unknown role", () => {
		expect(SDKMessageSchema.safeParse({ role: "admin", content: "x" }).success).toBe(false);
	});

	it("accepts optional timestamp", () => {
		const result = SDKMessageSchema.safeParse({
			role: "user",
			content: "hello",
			timestamp: "2024-01-01T00:00:00Z",
		});
		expect(result.success).toBe(true);
	});
});

// ── SDKToolCallSchema ─────────────────────────────────────────────────────────

describe("SDKToolCallSchema", () => {
	it("accepts a valid tool call", () => {
		const result = SDKToolCallSchema.safeParse({
			id: "call-1",
			type: "function",
			function: { name: "search", arguments: { query: "hello" } },
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing function name", () => {
		const result = SDKToolCallSchema.safeParse({
			id: "call-1",
			type: "function",
			function: { arguments: { query: "hello" } },
		});
		expect(result.success).toBe(false);
	});

	it("accepts result and timestamp", () => {
		const result = SDKToolCallSchema.safeParse({
			id: "call-1",
			type: "function",
			function: { name: "search", arguments: {} },
			result: { items: [] },
			timestamp: "2024-01-01T00:00:00Z",
		});
		expect(result.success).toBe(true);
	});
});

// ── SDKTestResultSchema ───────────────────────────────────────────────────────

describe("SDKTestResultSchema", () => {
	const minimal = {
		testCaseId: 42,
		status: "passed",
		output: "Hello world",
		score: 85.5,
		error: null,
		durationMs: 1200,
	};

	it("accepts a minimal valid test result", () => {
		expect(SDKTestResultSchema.safeParse(minimal).success).toBe(true);
	});

	it("accepts null output and score", () => {
		const result = SDKTestResultSchema.safeParse({ ...minimal, output: null, score: null });
		expect(result.success).toBe(true);
	});

	it("rejects score > 100", () => {
		const result = SDKTestResultSchema.safeParse({ ...minimal, score: 101 });
		expect(result.success).toBe(false);
	});

	it("rejects score < 0", () => {
		const result = SDKTestResultSchema.safeParse({ ...minimal, score: -1 });
		expect(result.success).toBe(false);
	});

	it("rejects invalid status", () => {
		const result = SDKTestResultSchema.safeParse({ ...minimal, status: "cancelled" });
		expect(result.success).toBe(false);
	});

	it("accepts assertions array", () => {
		const result = SDKTestResultSchema.safeParse({
			...minimal,
			assertions: [{ key: "pii", category: "privacy", passed: true }],
		});
		expect(result.success).toBe(true);
	});

	it("rejects durationMs < 0", () => {
		const result = SDKTestResultSchema.safeParse({ ...minimal, durationMs: -1 });
		expect(result.success).toBe(false);
	});
});

// ── SDKTraceSpanSchema ────────────────────────────────────────────────────────

describe("SDKTraceSpanSchema", () => {
	const minimal = {
		spanId: "span-1",
		parentSpanId: null,
		name: "llm-call",
		type: "llm",
		startTime: "2024-01-01T00:00:00Z",
		endTime: null,
		durationMs: null,
		input: null,
		output: null,
	};

	it("accepts a minimal span", () => {
		expect(SDKTraceSpanSchema.safeParse(minimal).success).toBe(true);
	});

	it("accepts span with messages and toolCalls", () => {
		const result = SDKTraceSpanSchema.safeParse({
			...minimal,
			messages: [{ role: "user", content: "hello" }],
			toolCalls: [{ id: "c1", type: "function", function: { name: "fn", arguments: {} } }],
		});
		expect(result.success).toBe(true);
	});
});

// ── SDKTraceSchema ────────────────────────────────────────────────────────────

describe("SDKTraceSchema", () => {
	const minimalSpan = {
		spanId: "s1",
		parentSpanId: null,
		name: "llm",
		type: "llm",
		startTime: "2024-01-01T00:00:00Z",
		endTime: null,
		durationMs: null,
		input: null,
		output: null,
	};

	const minimalTrace = {
		traceId: "trace-1",
		evaluationId: 1,
		runId: "run-abc",
		status: "completed",
		startTime: "2024-01-01T00:00:00Z",
		endTime: null,
		durationMs: null,
		spans: [minimalSpan],
	};

	it("accepts a minimal valid trace", () => {
		expect(SDKTraceSchema.safeParse(minimalTrace).success).toBe(true);
	});

	it("rejects invalid status", () => {
		const result = SDKTraceSchema.safeParse({ ...minimalTrace, status: "archived" });
		expect(result.success).toBe(false);
	});

	it("accepts empty spans array", () => {
		const result = SDKTraceSchema.safeParse({ ...minimalTrace, spans: [] });
		expect(result.success).toBe(true);
	});
});

// ── SDKEvaluationResultSchema ─────────────────────────────────────────────────

describe("SDKEvaluationResultSchema", () => {
	const minimalResult = {
		testCaseId: 1,
		status: "passed",
		output: "ok",
		score: 90,
		error: null,
		durationMs: 500,
	};

	const minimalEval = {
		evaluationId: 1,
		runId: "run-1",
		status: "completed",
		totalCases: 1,
		processedCases: 1,
		passedCases: 1,
		failedCases: 0,
		startedAt: "2024-01-01T00:00:00Z",
		completedAt: null,
		durationMs: null,
		results: [minimalResult],
	};

	it("accepts a valid evaluation result", () => {
		expect(SDKEvaluationResultSchema.safeParse(minimalEval).success).toBe(true);
	});

	it("rejects invalid status", () => {
		const result = SDKEvaluationResultSchema.safeParse({ ...minimalEval, status: "archived" });
		expect(result.success).toBe(false);
	});
});

// ── Validation helpers ────────────────────────────────────────────────────────

describe("validateSDKTestResult", () => {
	it("returns parsed data for valid input", () => {
		const data = validateSDKTestResult({
			testCaseId: 1,
			status: "passed",
			output: "ok",
			score: 80,
			error: null,
			durationMs: 100,
		});
		expect(data.testCaseId).toBe(1);
		expect(data.status).toBe("passed");
	});

	it("throws for invalid input", () => {
		expect(() => validateSDKTestResult({ testCaseId: "not-a-number" })).toThrow();
	});
});

describe("validateSDKEvaluationResult", () => {
	it("throws for empty object", () => {
		expect(() => validateSDKEvaluationResult({})).toThrow();
	});
});

describe("validateSDKTrace", () => {
	it("throws for missing traceId", () => {
		expect(() => validateSDKTrace({ evaluationId: 1, runId: "x" })).toThrow();
	});
});
