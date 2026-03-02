import { describe, expect, it } from "vitest";
import {
	minimizeTrace,
	type TraceForMinimization,
	type TraceSpanInput,
} from "@/lib/testgen/trace-minimizer";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function llmSpan(
	id: string,
	messages: TraceSpanInput["messages"] = [],
	overrides: Partial<TraceSpanInput> = {},
): TraceSpanInput {
	return {
		spanId: id,
		name: `span-${id}`,
		type: "llm",
		messages,
		...overrides,
	};
}

function toolSpan(id: string, tools: string[]): TraceSpanInput {
	return {
		spanId: id,
		name: `tool-${id}`,
		type: "tool",
		toolCalls: tools.map((t) => ({ name: t, arguments: {} })),
	};
}

const BASIC_TRACE: TraceForMinimization = {
	traceId: "trace-1",
	spans: [
		llmSpan("s1", [
			{ role: "system", content: "You are a helpful assistant." },
			{ role: "user", content: "What is the capital of France?" },
			{ role: "assistant", content: "The capital of France is Paris." },
		]),
	],
};

// ── userPrompt extraction ─────────────────────────────────────────────────────

describe("minimizeTrace — userPrompt", () => {
	it("extracts last user message from failure span", () => {
		const result = minimizeTrace(BASIC_TRACE);
		expect(result.userPrompt).toBe("What is the capital of France?");
	});

	it("extracts prompt from span.input string", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [
				{ spanId: "s1", name: "n", type: "llm", input: "Tell me a joke" },
			],
		};
		const result = minimizeTrace(trace);
		expect(result.userPrompt).toBe("Tell me a joke");
	});

	it("extracts prompt from span.input object with prompt key", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [
				{
					spanId: "s1",
					name: "n",
					type: "llm",
					input: { prompt: "What is 2+2?" },
				},
			],
		};
		const result = minimizeTrace(trace);
		expect(result.userPrompt).toBe("What is 2+2?");
	});

	it("returns empty string when no user message found", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [{ spanId: "s1", name: "n", type: "tool" }],
		};
		const result = minimizeTrace(trace);
		expect(result.userPrompt).toBe("");
	});
});

// ── systemPrompt extraction ───────────────────────────────────────────────────

describe("minimizeTrace — systemPrompt", () => {
	it("extracts system prompt from messages", () => {
		const result = minimizeTrace(BASIC_TRACE);
		expect(result.systemPrompt).toBe("You are a helpful assistant.");
	});

	it("returns null when no system message", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [llmSpan("s1", [{ role: "user", content: "Hello" }])],
		};
		const result = minimizeTrace(trace);
		expect(result.systemPrompt).toBeNull();
	});
});

// ── failureSpan targeting ─────────────────────────────────────────────────────

describe("minimizeTrace — failureSpanId targeting", () => {
	it("targets the specified failureSpanId", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			failureSpanId: "s2",
			spans: [
				llmSpan("s1", [{ role: "user", content: "First question" }]),
				llmSpan("s2", [{ role: "user", content: "Failed question" }]),
			],
		};
		const result = minimizeTrace(trace);
		expect(result.failureSpanId).toBe("s2");
		expect(result.userPrompt).toBe("Failed question");
	});

	it("falls back to last LLM span when no failureSpanId", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [
				llmSpan("s1", [{ role: "user", content: "First" }]),
				llmSpan("s2", [{ role: "user", content: "Last" }]),
			],
		};
		const result = minimizeTrace(trace);
		expect(result.failureSpanId).toBe("s2");
		expect(result.userPrompt).toBe("Last");
	});

	it("returns null failureSpanId when no LLM spans", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [toolSpan("t1", ["search"])],
		};
		const result = minimizeTrace(trace);
		expect(result.failureSpanId).toBeNull();
	});
});

// ── failureOutput extraction ──────────────────────────────────────────────────

describe("minimizeTrace — failureOutput", () => {
	it("extracts output from assistant message", () => {
		const result = minimizeTrace(BASIC_TRACE);
		expect(result.failureOutput).toBe("The capital of France is Paris.");
	});

	it("extracts error message when span has error", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [llmSpan("s1", [], { error: { message: "Rate limit exceeded" } })],
		};
		const result = minimizeTrace(trace);
		expect(result.failureOutput).toBe("Rate limit exceeded");
	});

	it("extracts string output directly", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [llmSpan("s1", [], { output: "Direct output" })],
		};
		const result = minimizeTrace(trace);
		expect(result.failureOutput).toBe("Direct output");
	});

	it("returns null when no output or failure span", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [toolSpan("t1", ["search"])],
		};
		const result = minimizeTrace(trace);
		expect(result.failureOutput).toBeNull();
	});
});

// ── activeTools extraction ────────────────────────────────────────────────────

describe("minimizeTrace — activeTools", () => {
	it("collects all unique tool names across spans", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [
				toolSpan("t1", ["search", "calc"]),
				toolSpan("t2", ["search", "db_query"]),
			],
		};
		const result = minimizeTrace(trace);
		expect(result.activeTools).toHaveLength(3);
		expect(result.activeTools).toContain("search");
		expect(result.activeTools).toContain("calc");
		expect(result.activeTools).toContain("db_query");
	});

	it("returns empty array when no tool calls", () => {
		const result = minimizeTrace(BASIC_TRACE);
		expect(result.activeTools).toHaveLength(0);
	});
});

// ── conversationContext ───────────────────────────────────────────────────────

describe("minimizeTrace — conversationContext", () => {
	it("excludes system messages from context", () => {
		const result = minimizeTrace(BASIC_TRACE);
		const hasSystem = result.conversationContext.some(
			(m) => m.role === "system",
		);
		expect(hasSystem).toBe(false);
	});

	it("limits context to last N turns", () => {
		const messages = Array.from({ length: 20 }, (_, i) => ({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `Message ${i}`,
		}));
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [llmSpan("s1", messages)],
		};
		const result = minimizeTrace(trace);
		expect(result.conversationContext.length).toBeLessThanOrEqual(10); // MAX_CONTEXT_TURNS * 2
	});
});

// ── metadata extraction ───────────────────────────────────────────────────────

describe("minimizeTrace — metadata", () => {
	it("extracts known metadata fields", () => {
		const trace: TraceForMinimization = {
			traceId: "t",
			spans: [
				llmSpan("s1", [], {
					metadata: {
						model: "gpt-4o",
						provider: "openai",
						temperature: 0.7,
						cost: 0.01,
					},
				}),
			],
		};
		const result = minimizeTrace(trace);
		expect(result.metadata.model).toBe("gpt-4o");
		expect(result.metadata.provider).toBe("openai");
		expect(result.metadata.temperature).toBe(0.7);
		expect(result.metadata.cost).toBe(0.01);
	});

	it("returns empty metadata when span has none", () => {
		const result = minimizeTrace(BASIC_TRACE);
		expect(result.metadata).toEqual({});
	});
});
