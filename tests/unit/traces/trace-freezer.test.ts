import { describe, expect, it } from "vitest";
import {
	determineReplayTier,
	FROZEN_SNAPSHOT_VERSION,
	freezeTrace,
	type TraceForFreezing,
} from "@/lib/traces/trace-freezer";

const minimalTrace: TraceForFreezing = {
	traceId: "trace-freeze-1",
	spans: [
		{
			spanId: "span-1",
			name: "llm-call",
			type: "llm",
			input: "hello",
			output: "world",
			durationMs: 500,
			metadata: { model: "gpt-4o", provider: "openai", temperature: 0.7 },
		},
	],
	environment: {
		runtime: "node",
		sdkVersion: "1.0.0",
		deployEnvironment: "prod",
		commitSha: "abc123",
	},
};

describe("freezeTrace", () => {
	it("produces a frozen snapshot with correct traceId and version", () => {
		const snapshot = freezeTrace(minimalTrace);
		expect(snapshot.traceId).toBe("trace-freeze-1");
		expect(snapshot.snapshotVersion).toBe(FROZEN_SNAPSHOT_VERSION);
		expect(snapshot.frozenAt).toBeTruthy();
	});

	it("captures model config from first llm span", () => {
		const snapshot = freezeTrace(minimalTrace);
		expect(snapshot.modelConfig.model).toBe("gpt-4o");
		expect(snapshot.modelConfig.provider).toBe("openai");
		expect(snapshot.modelConfig.temperature).toBe(0.7);
	});

	it("snapshots all spans", () => {
		const snapshot = freezeTrace(minimalTrace);
		expect(snapshot.spans).toHaveLength(1);
		expect(snapshot.spans[0]!.spanId).toBe("span-1");
	});

	it("marks redacted: true by default (redaction on by default)", () => {
		const snapshot = freezeTrace(minimalTrace);
		expect(snapshot.redacted).toBe(true);
		expect(snapshot.redactionProfileId).toBe("default");
	});

	it("marks redacted: false when applyRedaction=false", () => {
		const snapshot = freezeTrace(minimalTrace, { applyRedaction: false });
		expect(snapshot.redacted).toBe(false);
		expect(snapshot.redactionProfileId).toBeNull();
	});

	it("includes commitSha from environment", () => {
		const snapshot = freezeTrace(minimalTrace);
		expect(snapshot.commitSha).toBe("abc123");
	});

	it("allows overriding commitSha via options", () => {
		const snapshot = freezeTrace(minimalTrace, { commitSha: "override-sha" });
		expect(snapshot.commitSha).toBe("override-sha");
	});

	it("captures tool calls in spans when mode is full", () => {
		const trace: TraceForFreezing = {
			traceId: "t-tool",
			spans: [
				{
					spanId: "s-1",
					name: "agent",
					type: "tool",
					behavioral: {
						toolCalls: [
							{
								name: "search",
								arguments: { q: "test" },
								output: ["result"],
								success: true,
							},
						],
					},
				},
			],
		};
		const snapshot = freezeTrace(trace, { toolOutputCaptureMode: "full" });
		expect(snapshot.spans[0]!.toolCalls[0]!.output).toEqual(["result"]);
		expect(snapshot.spans[0]!.toolCalls[0]!.captureMode).toBe("full");
	});

	it("omits tool output when mode is none", () => {
		const trace: TraceForFreezing = {
			traceId: "t-tool",
			spans: [
				{
					spanId: "s-1",
					name: "agent",
					type: "tool",
					behavioral: {
						toolCalls: [
							{ name: "search", arguments: { q: "test" }, output: ["result"] },
						],
					},
				},
			],
		};
		const snapshot = freezeTrace(trace, { toolOutputCaptureMode: "none" });
		expect(snapshot.spans[0]!.toolCalls[0]!.output).toBeNull();
		expect(snapshot.spans[0]!.toolCalls[0]!.captureMode).toBe("none");
	});

	it("captures reasoning segments", () => {
		const trace: TraceForFreezing = {
			traceId: "t-reason",
			spans: [
				{
					spanId: "s-1",
					name: "llm",
					type: "llm",
					behavioral: {
						reasoningSegments: [
							{
								stepIndex: 0,
								type: "chain_of_thought",
								content: "step 1",
								confidence: 0.9,
							},
						],
					},
				},
			],
		};
		const snapshot = freezeTrace(trace);
		expect(snapshot.spans[0]!.reasoningSegments).toHaveLength(1);
		expect(snapshot.spans[0]!.reasoningSegments[0]!.confidence).toBe(0.9);
	});
});

describe("determineReplayTier", () => {
	it("assigns Tier A when all determinism criteria met", () => {
		const spans = [
			{
				spanId: "s-1",
				name: "llm",
				type: "llm",
				model: "gpt-4o",
				provider: "openai",
				temperature: 0.0,
				toolCalls: [],
				messages: [],
				retrievedDocuments: [],
				reasoningSegments: [],
				input: null,
				output: null,
				durationMs: null,
				error: null,
			},
		];
		const tier = determineReplayTier(spans, "full", "abc123", []);
		expect(tier).toBe("A");
	});

	it("assigns Tier B when commitSha is missing", () => {
		const spans = [
			{
				spanId: "s-1",
				name: "llm",
				type: "llm",
				model: "gpt-4o",
				provider: "openai",
				temperature: 0.0,
				toolCalls: [],
				messages: [],
				retrievedDocuments: [],
				reasoningSegments: [],
				input: null,
				output: null,
				durationMs: null,
				error: null,
			},
		];
		const tier = determineReplayTier(spans, "full", null, []);
		expect(tier).toBe("B");
	});

	it("assigns Tier C when external deps are uncaptured", () => {
		const tier = determineReplayTier([], "full", "abc123", [
			{ name: "external-api", type: "api", captured: false },
		]);
		expect(tier).toBe("C");
	});

	it("assigns Tier B when tool output capture is none but tool calls exist", () => {
		const spans = [
			{
				spanId: "s-1",
				name: "tool",
				type: "tool",
				model: null,
				provider: null,
				temperature: null,
				toolCalls: [
					{
						name: "search",
						arguments: {},
						output: null,
						success: null,
						captureMode: "none" as const,
					},
				],
				messages: [],
				retrievedDocuments: [],
				reasoningSegments: [],
				input: null,
				output: null,
				durationMs: null,
				error: null,
			},
		];
		const tier = determineReplayTier(spans, "none", "abc123", []);
		expect(tier).toBe("B");
	});
});
