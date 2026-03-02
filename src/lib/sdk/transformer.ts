// src/lib/sdk/transformer.ts

import type { evaluationRuns, testResults } from "@/db/schema";
import type {
	AssertionResult,
	AssertionsEnvelope,
} from "@/lib/eval/assertions";
import type { SDKEvaluationResult, SDKTestResult, SDKTrace } from "./mapper";

/**
 * Transform SDK test result to database format.
 * Handles type conversion and data mapping.
 * When SDK provides assertions, converts to canonical envelope.
 */
export function transformTestResultToDB(
	sdkResult: SDKTestResult,
	evaluationRunId: number,
	organizationId: number,
): Omit<typeof testResults.$inferInsert, "id" | "createdAt"> {
	let assertionsJson: AssertionsEnvelope | null = null;
	if (sdkResult.assertions?.length) {
		const assertions: AssertionResult[] = sdkResult.assertions.map((a) => ({
			key: a.key as AssertionResult["key"],
			category: a.category,
			passed: a.passed,
			score: a.score,
			severity: a.severity,
			details: a.details,
		}));
		assertionsJson = { version: "v1", assertions };
	}

	return {
		evaluationRunId,
		testCaseId: sdkResult.testCaseId,
		organizationId,
		status: sdkResult.status,
		output: sdkResult.output,
		score: sdkResult.score,
		error: sdkResult.error,
		durationMs: sdkResult.durationMs,
		messages: (sdkResult.messages ||
			[]) as import("@/db/types").TestResultMessage[],
		toolCalls: (sdkResult.toolCalls || []) as import("@/db/types").ToolCall[],
		...(assertionsJson && {
			assertionsJson:
				assertionsJson as unknown as import("@/db/types").AssertionsJson,
		}),
	};
}

/**
 * Transform SDK evaluation result to database format.
 * Handles both the run metadata and individual test results.
 */
export function transformEvaluationResultToDB(
	sdkResult: SDKEvaluationResult,
	organizationId: number,
	userId: string,
): {
	run: Omit<typeof evaluationRuns.$inferInsert, "id" | "createdAt">;
	testResults: Array<Omit<typeof testResults.$inferInsert, "id" | "createdAt">>;
} {
	const _now = new Date().toISOString();

	// Transform the main run record
	const run: Omit<typeof evaluationRuns.$inferInsert, "id" | "createdAt"> = {
		evaluationId: sdkResult.evaluationId,
		organizationId,
		status: sdkResult.status,
		totalCases: sdkResult.totalCases,
		processedCount: sdkResult.processedCases,
		passedCases: sdkResult.passedCases,
		failedCases: sdkResult.failedCases,
		startedAt: sdkResult.startedAt ? new Date(sdkResult.startedAt) : undefined,
		completedAt: sdkResult.completedAt ? new Date(sdkResult.completedAt) : null,
		traceLog: {
			sdkRunId: sdkResult.runId,
			organizationId,
			userId,
			startedAt: sdkResult.startedAt,
			completedAt: sdkResult.completedAt,
			durationMs: sdkResult.durationMs,
			metadata: sdkResult.metadata,
		} as import("@/db/types").TraceLog,
	};

	// Transform all test results
	const transformedResults = sdkResult.results.map(
		(result) => transformTestResultToDB(result, 0, organizationId), // runId will be set after insertion
	);

	return { run, testResults: transformedResults };
}

/**
 * Transform SDK trace to database format.
 * Converts the hierarchical trace structure to JSON for storage.
 */
export function transformTraceToDB(
	sdkTrace: SDKTrace,
	organizationId: number,
): {
	traceLog: import("@/db/types").TraceLog;
	metadata: Record<string, unknown>;
} {
	return {
		traceLog: {
			traceId: sdkTrace.traceId,
			evaluationId: sdkTrace.evaluationId,
			runId: sdkTrace.runId,
			organizationId,
			status: sdkTrace.status,
			startTime: sdkTrace.startTime,
			endTime: sdkTrace.endTime,
			durationMs: sdkTrace.durationMs,
			spans: sdkTrace.spans.map((span) => ({
				spanId: span.spanId,
				parentSpanId: span.parentSpanId,
				name: span.name,
				type: span.type,
				startTime: span.startTime,
				endTime: span.endTime,
				durationMs: span.durationMs,
				input: span.input,
				output: span.output,
				messages: span.messages || [],
				toolCalls: span.toolCalls || [],
				metadata: span.metadata || {},
			})),
			metadata: sdkTrace.metadata,
		} as import("@/db/types").TraceLog,
		metadata: {
			organizationId,
			sdkTraceId: sdkTrace.traceId,
			sdkRunId: sdkTrace.runId,
			status: sdkTrace.status,
			duration: sdkTrace.durationMs,
			spanCount: sdkTrace.spans.length,
			messageCount: sdkTrace.spans.reduce(
				(total, span) => total + (span.messages?.length || 0),
				0,
			),
			toolCallCount: sdkTrace.spans.reduce(
				(total, span) => total + (span.toolCalls?.length || 0),
				0,
			),
		},
	};
}

/**
 * Extract messages from SDK trace for terminal streaming.
 * Flattens the hierarchical structure into a chronological array.
 */
export function extractMessagesFromTrace(sdkTrace: SDKTrace): Array<{
	timestamp: string;
	role: string;
	content: string;
	spanName?: string;
	toolCall?: unknown;
}> {
	const messages: Array<{
		timestamp: string;
		role: string;
		content: string;
		spanName?: string;
		toolCall?: unknown;
	}> = [];

	for (const span of sdkTrace.spans) {
		if (span.messages) {
			for (const message of span.messages) {
				messages.push({
					timestamp: message.timestamp || span.startTime,
					role: message.role,
					content: message.content,
					spanName: span.name,
				});
			}
		}

		if (span.toolCalls) {
			for (const toolCall of span.toolCalls) {
				messages.push({
					timestamp: toolCall.timestamp || span.startTime,
					role: "tool",
					content: `Calling ${toolCall.function.name} with args: ${JSON.stringify(toolCall.function.arguments)}`,
					spanName: span.name,
					toolCall: toolCall,
				});

				if (toolCall.result) {
					messages.push({
						timestamp: toolCall.timestamp || span.startTime,
						role: "tool_result",
						content: `Result: ${JSON.stringify(toolCall.result)}`,
						spanName: span.name,
						toolCall: toolCall,
					});
				}
			}
		}
	}

	// Sort by timestamp for chronological order
	return messages.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
}

/**
 * Extract tool calls from SDK trace for debugging.
 */
export function extractToolCallsFromTrace(sdkTrace: SDKTrace): Array<{
	timestamp: string;
	spanName: string;
	toolName: string;
	arguments: unknown;
	result?: unknown;
	duration?: number;
}> {
	const toolCalls: Array<{
		timestamp: string;
		spanName: string;
		toolName: string;
		arguments: unknown;
		result?: unknown;
		duration?: number;
	}> = [];

	for (const span of sdkTrace.spans) {
		if (span.toolCalls) {
			for (const toolCall of span.toolCalls) {
				const duration =
					span.endTime && span.startTime
						? new Date(span.endTime).getTime() -
							new Date(span.startTime).getTime()
						: undefined;

				toolCalls.push({
					timestamp: toolCall.timestamp || span.startTime,
					spanName: span.name,
					toolName: toolCall.function.name,
					arguments: toolCall.function.arguments,
					result: toolCall.result,
					duration,
				});
			}
		}
	}

	return toolCalls.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
}

/**
 * Calculate evaluation metrics from SDK results.
 */
export function calculateMetrics(sdkResult: SDKEvaluationResult): {
	passRate: number;
	averageScore: number;
	averageDuration: number;
	totalDuration: number;
} {
	const passRate =
		sdkResult.totalCases > 0
			? Math.round((sdkResult.passedCases / sdkResult.totalCases) * 100)
			: 0;

	const scores = sdkResult.results
		.map((r) => r.score)
		.filter((score) => score !== null && score !== undefined) as number[];

	const averageScore =
		scores.length > 0
			? Math.round(
					scores.reduce((sum, score) => sum + score, 0) / scores.length,
				)
			: 0;

	const durations = sdkResult.results
		.map((r) => r.durationMs)
		.filter(
			(duration) => duration !== null && duration !== undefined,
		) as number[];

	const averageDuration =
		durations.length > 0
			? Math.round(
					durations.reduce((sum, duration) => sum + duration, 0) /
						durations.length,
				)
			: 0;

	const totalDuration = sdkResult.durationMs || 0;

	return {
		passRate,
		averageScore,
		averageDuration,
		totalDuration,
	};
}
