import { describe, expect, it } from "vitest";
import {
	calculateMetrics,
	extractMessagesFromTrace,
	extractToolCallsFromTrace,
	transformTestResultToDB,
	transformTraceToDB,
} from "@/lib/sdk/transformer";
import type { SDKEvaluationResult, SDKTestResult, SDKTrace } from "@/lib/sdk/mapper";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTestResult(overrides: Partial<SDKTestResult> = {}): SDKTestResult {
	return {
		testCaseId: 1,
		status: "passed",
		output: "The answer is 42.",
		score: 88,
		error: null,
		durationMs: 1200,
		...overrides,
	};
}

function makeTrace(overrides: Partial<SDKTrace> = {}): SDKTrace {
	return {
		traceId: "trace-abc",
		evaluationId: 1,
		runId: "run-001",
		status: "completed",
		startTime: "2024-01-01T00:00:00.000Z",
		endTime: "2024-01-01T00:00:01.000Z",
		durationMs: 1000,
		spans: [
			{
				spanId: "span-1",
				parentSpanId: null,
				name: "llm-call",
				type: "llm",
				startTime: "2024-01-01T00:00:00.000Z",
				endTime: "2024-01-01T00:00:00.800Z",
				durationMs: 800,
				input: "What is 6 × 7?",
				output: "42",
				messages: [
					{ role: "system", content: "You are helpful." },
					{ role: "user", content: "What is 6 × 7?" },
					{ role: "assistant", content: "42" },
				],
				toolCalls: [
					{
						id: "tc-1",
						type: "function",
						function: { name: "calculator", arguments: { a: 6, b: 7, op: "multiply" } },
						result: 42,
						timestamp: "2024-01-01T00:00:00.200Z",
					},
				],
			},
		],
		...overrides,
	};
}

function makeEvalResult(overrides: Partial<SDKEvaluationResult> = {}): SDKEvaluationResult {
	return {
		evaluationId: 1,
		runId: "run-001",
		status: "completed",
		totalCases: 4,
		processedCases: 4,
		passedCases: 3,
		failedCases: 1,
		startedAt: "2024-01-01T00:00:00Z",
		completedAt: "2024-01-01T00:01:00Z",
		durationMs: 60000,
		results: [
			makeTestResult({ score: 90 }),
			makeTestResult({ score: 80 }),
			makeTestResult({ score: 70, status: "failed" }),
			makeTestResult({ score: null }),
		],
		...overrides,
	};
}

// ── transformTestResultToDB ───────────────────────────────────────────────────

describe("transformTestResultToDB", () => {
	it("maps required fields correctly", () => {
		const row = transformTestResultToDB(makeTestResult(), 5, 99);
		expect(row.evaluationRunId).toBe(5);
		expect(row.testCaseId).toBe(1);
		expect(row.organizationId).toBe(99);
		expect(row.status).toBe("passed");
		expect(row.output).toBe("The answer is 42.");
		expect(row.score).toBe(88);
		expect(row.durationMs).toBe(1200);
	});

	it("JSON-serializes messages array", () => {
		const messages = [{ role: "user", content: "Hi" }];
		const row = transformTestResultToDB(makeTestResult({ messages }), 1, 1);
		const parsed = JSON.parse(row.messages as string);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].role).toBe("user");
	});

	it("JSON-serializes tool calls array", () => {
		const toolCalls = [{ id: "tc1", name: "search" }];
		const row = transformTestResultToDB(makeTestResult({ toolCalls }), 1, 1);
		const parsed = JSON.parse(row.toolCalls as string);
		expect(parsed).toHaveLength(1);
	});

	it("serializes empty arrays for missing messages/toolCalls", () => {
		const row = transformTestResultToDB(makeTestResult(), 1, 1);
		expect(JSON.parse(row.messages as string)).toEqual([]);
		expect(JSON.parse(row.toolCalls as string)).toEqual([]);
	});

	it("converts assertions to AssertionsEnvelope", () => {
		const tc = makeTestResult({
			assertions: [
				{ key: "no_pii", category: "privacy", passed: true },
				{ key: "safe", category: "safety", passed: false, score: 0.1, severity: "high" },
			],
		});
		const row = transformTestResultToDB(tc, 1, 1);
		expect((row as Record<string, unknown>).assertionsJson).toBeDefined();
		const env = (row as Record<string, unknown>).assertionsJson as { version: string; assertions: unknown[] };
		expect(env.version).toBe("v1");
		expect(env.assertions).toHaveLength(2);
	});

	it("omits assertionsJson when assertions are absent", () => {
		const row = transformTestResultToDB(makeTestResult(), 1, 1);
		expect((row as Record<string, unknown>).assertionsJson).toBeUndefined();
	});

	it("passes null output and score through", () => {
		const row = transformTestResultToDB(makeTestResult({ output: null, score: null }), 1, 1);
		expect(row.output).toBeNull();
		expect(row.score).toBeNull();
	});
});

// ── transformTraceToDB ────────────────────────────────────────────────────────

describe("transformTraceToDB", () => {
	it("returns traceLog as valid JSON string", () => {
		const { traceLog } = transformTraceToDB(makeTrace(), 42);
		expect(() => JSON.parse(traceLog)).not.toThrow();
	});

	it("includes traceId and spans in traceLog", () => {
		const { traceLog } = transformTraceToDB(makeTrace(), 42);
		const parsed = JSON.parse(traceLog);
		expect(parsed.traceId).toBe("trace-abc");
		expect(Array.isArray(parsed.spans)).toBe(true);
		expect(parsed.spans).toHaveLength(1);
	});

	it("returns metadata with span and message counts", () => {
		const { metadata } = transformTraceToDB(makeTrace(), 42);
		expect(metadata.spanCount).toBe(1);
		expect(metadata.messageCount).toBe(3);
		expect(metadata.toolCallCount).toBe(1);
		expect(metadata.organizationId).toBe(42);
	});

	it("handles trace with no spans", () => {
		const { metadata } = transformTraceToDB(makeTrace({ spans: [] }), 1);
		expect(metadata.spanCount).toBe(0);
		expect(metadata.messageCount).toBe(0);
		expect(metadata.toolCallCount).toBe(0);
	});
});

// ── extractMessagesFromTrace ──────────────────────────────────────────────────

describe("extractMessagesFromTrace", () => {
	it("extracts messages from all spans in chronological order", () => {
		const messages = extractMessagesFromTrace(makeTrace());
		expect(messages.length).toBeGreaterThanOrEqual(3);
		const roles = messages.map((m) => m.role);
		expect(roles).toContain("system");
		expect(roles).toContain("user");
		expect(roles).toContain("assistant");
	});

	it("includes tool call entries", () => {
		const messages = extractMessagesFromTrace(makeTrace());
		const toolEntries = messages.filter((m) => m.role === "tool");
		expect(toolEntries.length).toBeGreaterThan(0);
		expect(toolEntries[0]!.content).toContain("calculator");
	});

	it("includes tool result entries", () => {
		const messages = extractMessagesFromTrace(makeTrace());
		const resultEntries = messages.filter((m) => m.role === "tool_result");
		expect(resultEntries.length).toBeGreaterThan(0);
	});

	it("returns empty array for trace with no spans", () => {
		const messages = extractMessagesFromTrace(makeTrace({ spans: [] }));
		expect(messages).toHaveLength(0);
	});

	it("attaches spanName to each message", () => {
		const messages = extractMessagesFromTrace(makeTrace());
		const nonToolMessages = messages.filter((m) => m.role !== "tool" && m.role !== "tool_result");
		for (const msg of nonToolMessages) {
			expect(msg.spanName).toBe("llm-call");
		}
	});

	it("sorts output chronologically by timestamp", () => {
		const messages = extractMessagesFromTrace(makeTrace());
		for (let i = 1; i < messages.length; i++) {
			const prev = new Date(messages[i - 1]!.timestamp).getTime();
			const curr = new Date(messages[i]!.timestamp).getTime();
			expect(prev).toBeLessThanOrEqual(curr);
		}
	});
});

// ── extractToolCallsFromTrace ─────────────────────────────────────────────────

describe("extractToolCallsFromTrace", () => {
	it("extracts tool calls from all spans", () => {
		const toolCalls = extractToolCallsFromTrace(makeTrace());
		expect(toolCalls).toHaveLength(1);
		expect(toolCalls[0]!.toolName).toBe("calculator");
	});

	it("includes arguments and result", () => {
		const [tc] = extractToolCallsFromTrace(makeTrace());
		expect((tc!.arguments as Record<string, unknown>).a).toBe(6);
		expect(tc!.result).toBe(42);
	});

	it("computes duration from span start/end", () => {
		const [tc] = extractToolCallsFromTrace(makeTrace());
		expect(typeof tc!.duration).toBe("number");
		expect(tc!.duration).toBeGreaterThan(0);
	});

	it("returns empty array for trace with no tool calls", () => {
		const traceNoTools = makeTrace({
			spans: [
				{
					spanId: "s1",
					parentSpanId: null,
					name: "llm",
					type: "llm",
					startTime: "2024-01-01T00:00:00Z",
					endTime: null,
					durationMs: null,
					input: null,
					output: null,
					messages: [{ role: "user", content: "hi" }],
				},
			],
		});
		expect(extractToolCallsFromTrace(traceNoTools)).toHaveLength(0);
	});
});

// ── calculateMetrics ──────────────────────────────────────────────────────────

describe("calculateMetrics", () => {
	it("computes passRate correctly", () => {
		const metrics = calculateMetrics(makeEvalResult());
		expect(metrics.passRate).toBe(75); // 3/4 * 100
	});

	it("computes averageScore from non-null scores only", () => {
		const metrics = calculateMetrics(makeEvalResult());
		// Scores: 90, 80, 70 (null excluded) → average = 80
		expect(metrics.averageScore).toBe(80);
	});

	it("returns passRate=0 for totalCases=0", () => {
		const metrics = calculateMetrics(
			makeEvalResult({ totalCases: 0, passedCases: 0, results: [] }),
		);
		expect(metrics.passRate).toBe(0);
	});

	it("returns averageScore=0 when all scores are null", () => {
		const metrics = calculateMetrics(
			makeEvalResult({
				results: [makeTestResult({ score: null }), makeTestResult({ score: null })],
			}),
		);
		expect(metrics.averageScore).toBe(0);
	});

	it("returns totalDuration from durationMs", () => {
		const metrics = calculateMetrics(makeEvalResult({ durationMs: 60000 }));
		expect(metrics.totalDuration).toBe(60000);
	});

	it("computes averageDuration across results", () => {
		const metrics = calculateMetrics(
			makeEvalResult({
				results: [
					makeTestResult({ durationMs: 1000 }),
					makeTestResult({ durationMs: 2000 }),
				],
			}),
		);
		expect(metrics.averageDuration).toBe(1500);
	});
});
