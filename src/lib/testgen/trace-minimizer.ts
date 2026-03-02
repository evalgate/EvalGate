/**
 * Trace Minimizer — Extract the minimal reproducing input from a full trace.
 *
 * A production trace contains everything: system prompts, multi-turn history,
 * tool results, metadata. The minimal input is the smallest context that
 * reproduces the failure. This is what goes into a test case.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TraceMessage {
	role: string;
	content: string;
	timestamp?: string;
}

export interface TraceToolCall {
	name: string;
	arguments: Record<string, unknown>;
	output?: unknown;
}

export interface TraceSpanInput {
	spanId: string;
	name: string;
	type: string;
	input?: unknown;
	output?: unknown;
	messages?: TraceMessage[];
	toolCalls?: TraceToolCall[];
	error?: { message: string; code?: string } | null;
	metadata?: Record<string, unknown>;
}

export interface TraceForMinimization {
	traceId: string;
	spans: TraceSpanInput[];
	failureSpanId?: string | null;
}

export interface MinimizedInput {
	/** The user-facing prompt / last user message */
	userPrompt: string;
	/** System prompt (if present and relevant) */
	systemPrompt: string | null;
	/** Tool definitions that were active */
	activeTools: string[];
	/** Relevant context (last N turns before failure) */
	conversationContext: TraceMessage[];
	/** The span that exhibited the failure */
	failureSpanId: string | null;
	/** Raw failure output (for rubric generation) */
	failureOutput: string | null;
	/** Metadata captured from the failure span */
	metadata: Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONTEXT_TURNS = 5;

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Extract the minimal reproducible input from a trace.
 * Focuses on the failure span (if known) or the last LLM span.
 */
export function minimizeTrace(trace: TraceForMinimization): MinimizedInput {
	const failureSpan = trace.failureSpanId
		? (trace.spans.find((s) => s.spanId === trace.failureSpanId) ?? null)
		: findLastLlmSpan(trace.spans);

	const systemPrompt = extractSystemPrompt(trace.spans);
	const userPrompt = extractUserPrompt(failureSpan, trace.spans);
	const conversationContext = extractConversationContext(
		failureSpan,
		trace.spans,
	);
	const activeTools = extractActiveTools(trace.spans);
	const failureOutput = extractOutput(failureSpan);
	const metadata = extractMetadata(failureSpan);

	return {
		userPrompt,
		systemPrompt,
		activeTools,
		conversationContext,
		failureSpanId: failureSpan?.spanId ?? null,
		failureOutput,
		metadata,
	};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findLastLlmSpan(spans: TraceSpanInput[]): TraceSpanInput | null {
	const llmSpans = spans.filter((s) => s.type === "llm" || s.type === "chat");
	return llmSpans.length > 0 ? llmSpans[llmSpans.length - 1]! : null;
}

function extractSystemPrompt(spans: TraceSpanInput[]): string | null {
	for (const span of spans) {
		if (!span.messages) continue;
		const systemMsg = span.messages.find((m) => m.role === "system");
		if (systemMsg) return systemMsg.content;
	}
	return null;
}

function extractUserPrompt(
	failureSpan: TraceSpanInput | null,
	spans: TraceSpanInput[],
): string {
	// Try to find last user message in failure span
	if (failureSpan?.messages) {
		const userMsgs = failureSpan.messages.filter((m) => m.role === "user");
		if (userMsgs.length > 0) return userMsgs[userMsgs.length - 1]!.content;
	}

	// Try span input directly
	if (failureSpan?.input && typeof failureSpan.input === "string") {
		return failureSpan.input;
	}
	if (failureSpan?.input && typeof failureSpan.input === "object") {
		const inp = failureSpan.input as Record<string, unknown>;
		if (typeof inp.prompt === "string") return inp.prompt;
		if (typeof inp.query === "string") return inp.query;
		if (typeof inp.message === "string") return inp.message;
	}

	// Scan all spans for the last user message
	for (let i = spans.length - 1; i >= 0; i--) {
		const span = spans[i]!;
		if (span.messages) {
			const userMsgs = span.messages.filter((m) => m.role === "user");
			if (userMsgs.length > 0) return userMsgs[userMsgs.length - 1]!.content;
		}
	}

	return "";
}

function extractConversationContext(
	failureSpan: TraceSpanInput | null,
	spans: TraceSpanInput[],
): TraceMessage[] {
	const allMessages: TraceMessage[] = [];

	for (const span of spans) {
		if (span.messages) {
			allMessages.push(...span.messages.filter((m) => m.role !== "system"));
		}
	}

	// Return last N turns before the final assistant message
	const trimmed = allMessages.slice(-MAX_CONTEXT_TURNS * 2);

	// Remove the last assistant message (that's the failure output we're testing)
	if (
		trimmed.length > 0 &&
		trimmed[trimmed.length - 1]!.role === "assistant" &&
		failureSpan !== null
	) {
		return trimmed.slice(0, -1);
	}

	return trimmed;
}

function extractActiveTools(spans: TraceSpanInput[]): string[] {
	const tools = new Set<string>();
	for (const span of spans) {
		if (span.toolCalls) {
			for (const tc of span.toolCalls) {
				tools.add(tc.name);
			}
		}
	}
	return Array.from(tools);
}

function extractOutput(span: TraceSpanInput | null): string | null {
	if (!span) return null;

	if (span.error) return span.error.message;

	if (typeof span.output === "string") return span.output;

	if (span.messages) {
		const assistantMsgs = span.messages.filter((m) => m.role === "assistant");
		if (assistantMsgs.length > 0) {
			return assistantMsgs[assistantMsgs.length - 1]!.content;
		}
	}

	if (span.output && typeof span.output === "object") {
		const out = span.output as Record<string, unknown>;
		if (typeof out.content === "string") return out.content;
		if (typeof out.text === "string") return out.text;
		return JSON.stringify(out).slice(0, 500);
	}

	return null;
}

function extractMetadata(span: TraceSpanInput | null): Record<string, unknown> {
	if (!span?.metadata) return {};
	const { model, provider, tokenCount, cost, temperature } = span.metadata;
	const result: Record<string, unknown> = {};
	if (model !== undefined) result.model = model;
	if (provider !== undefined) result.provider = provider;
	if (tokenCount !== undefined) result.tokenCount = tokenCount;
	if (cost !== undefined) result.cost = cost;
	if (temperature !== undefined) result.temperature = temperature;
	return result;
}
