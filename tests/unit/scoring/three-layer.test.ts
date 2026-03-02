import { describe, expect, it } from "vitest";
import { scoreActionLayer } from "@/lib/scoring/action-layer";
import {
	combineThreeLayerScores,
	scoreOutcomeLayer,
} from "@/lib/scoring/outcome-layer";
import { scoreReasoningLayer } from "@/lib/scoring/reasoning-layer";
import type { TraceSpanForExtraction } from "@/lib/scoring/trace-feature-extractor";
import { extractTraceFeatures } from "@/lib/scoring/trace-feature-extractor";

const spanWithReasoning: TraceSpanForExtraction = {
	spanId: "s-1",
	name: "llm",
	type: "llm",
	metadata: { model: "gpt-4o", tokenCount: 500, cost: 0.01 },
	behavioral: {
		reasoningSegments: [
			{
				stepIndex: 0,
				type: "chain_of_thought",
				content: "Let me think step by step...",
				confidence: 0.85,
			},
			{
				stepIndex: 1,
				type: "self_critique",
				content: "Actually, let me reconsider...",
				confidence: 0.9,
			},
		],
		toolCalls: [
			{
				name: "search",
				arguments: { query: "refund policy" },
				output: "Result: ...",
				success: true,
			},
			{
				name: "calculator",
				arguments: { expr: "10 * 1.1" },
				output: "11",
				success: true,
			},
		],
		retrievedDocuments: [
			{ documentId: "doc-1", score: 0.92, source: "knowledge-base" },
		],
	},
};

describe("extractTraceFeatures", () => {
	it("extracts tool graph entries", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		expect(features.toolGraph.length).toBe(2);
		expect(features.toolGraph.map((t) => t.name)).toContain("search");
	});

	it("extracts reasoning token counts", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		expect(features.reasoningTokens.totalSegments).toBe(2);
		expect(features.reasoningTokens.hasChainOfThought).toBe(true);
		expect(features.reasoningTokens.hasSelfCritique).toBe(true);
	});

	it("counts retrieved documents", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		expect(features.retrievalCount).toBe(1);
	});

	it("computes average confidence", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		expect(features.reasoningTokens.avgConfidence).toBeCloseTo(0.875);
	});

	it("sums cost from metadata", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		expect(features.totalCostUsd).toBeCloseTo(0.01);
	});

	it("detects error from behavioral.error", () => {
		const errorSpan: TraceSpanForExtraction = {
			spanId: "e-1",
			name: "llm-error",
			type: "llm",
			behavioral: { error: { message: "timeout", code: "TIMEOUT" } },
		};
		const features = extractTraceFeatures([errorSpan]);
		expect(features.hadError).toBe(true);
	});

	it("returns empty features for empty spans", () => {
		const features = extractTraceFeatures([]);
		expect(features.toolGraph).toHaveLength(0);
		expect(features.hadError).toBe(false);
		expect(features.totalCostUsd).toBeNull();
	});

	it("includes feature version", () => {
		const features = extractTraceFeatures([]);
		expect(features.featureVersion).toBe("v1");
	});
});

describe("scoreReasoningLayer", () => {
	it("returns neutral score when no reasoning data", () => {
		const features = extractTraceFeatures([
			{ spanId: "s", name: "n", type: "llm" },
		]);
		const score = scoreReasoningLayer(features);
		expect(score.score).toBe(0.5);
		expect(score.hasReasoningEvidence).toBe(false);
	});

	it("returns high score for full reasoning evidence", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreReasoningLayer(features);
		expect(score.score).toBeGreaterThan(0.7);
		expect(score.hasReasoningEvidence).toBe(true);
	});

	it("score is between 0 and 1", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreReasoningLayer(features);
		expect(score.score).toBeGreaterThanOrEqual(0);
		expect(score.score).toBeLessThanOrEqual(1);
	});

	it("includes explanation", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreReasoningLayer(features);
		expect(score.explanation.length).toBeGreaterThan(5);
	});

	it("chain_of_thought flag set correctly", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreReasoningLayer(features);
		expect(score.components.chainOfThoughtScore).toBeGreaterThanOrEqual(0.9);
	});
});

describe("scoreActionLayer", () => {
	it("returns neutral score for no actions", () => {
		const features = extractTraceFeatures([
			{ spanId: "s", name: "n", type: "llm" },
		]);
		const score = scoreActionLayer(features);
		expect(score.score).toBe(0.5);
		expect(score.hasActionEvidence).toBe(false);
	});

	it("returns high score for successful tool calls", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreActionLayer(features);
		expect(score.score).toBeGreaterThan(0.6);
		expect(score.hasActionEvidence).toBe(true);
	});

	it("penalizes failed tools", () => {
		const errorSpan: TraceSpanForExtraction = {
			spanId: "e",
			name: "llm",
			type: "llm",
			behavioral: {
				toolCalls: [{ name: "search", arguments: {}, success: false }],
			},
		};
		const features = extractTraceFeatures([errorSpan]);
		const goodFeatures = extractTraceFeatures([spanWithReasoning]);
		const badScore = scoreActionLayer(features);
		const goodScore = scoreActionLayer(goodFeatures);
		expect(goodScore.score).toBeGreaterThan(badScore.score);
	});

	it("score is between 0 and 1", () => {
		const features = extractTraceFeatures([spanWithReasoning]);
		const score = scoreActionLayer(features);
		expect(score.score).toBeGreaterThanOrEqual(0);
		expect(score.score).toBeLessThanOrEqual(1);
	});
});

describe("scoreOutcomeLayer", () => {
	it("returns full score with all assertions passing", () => {
		const result = scoreOutcomeLayer({
			assertionOutcomes: [
				{
					assertionKey: "contains",
					passed: true,
					score: 1.0,
					severity: "high",
					required: true,
				},
				{
					assertionKey: "no_pii",
					passed: true,
					score: 1.0,
					severity: "critical",
					required: true,
				},
			],
			finalOutput: "Here is your refund.",
			completedSuccessfully: true,
		});
		expect(result.score).toBeGreaterThan(0.8);
		expect(result.hardGateFailed).toBe(false);
	});

	it("hard gate failure caps score at 0.4", () => {
		const result = scoreOutcomeLayer({
			assertionOutcomes: [
				{
					assertionKey: "required_check",
					passed: false,
					score: 0,
					severity: "high",
					required: true,
				},
			],
			finalOutput: "some output",
			completedSuccessfully: true,
		});
		expect(result.hardGateFailed).toBe(true);
		expect(result.score).toBeLessThanOrEqual(0.4);
	});

	it("critical failure caps score at 0.2", () => {
		const result = scoreOutcomeLayer({
			assertionOutcomes: [
				{
					assertionKey: "no_pii",
					passed: false,
					score: 0,
					severity: "critical",
					required: false,
				},
			],
			finalOutput: "leaked PII",
			completedSuccessfully: true,
		});
		expect(result.criticalFailed).toBe(true);
		expect(result.score).toBeLessThanOrEqual(0.2);
	});

	it("completion failure penalizes score", () => {
		const completed = scoreOutcomeLayer({
			assertionOutcomes: [],
			finalOutput: "ok",
			completedSuccessfully: true,
		});
		const notCompleted = scoreOutcomeLayer({
			assertionOutcomes: [],
			finalOutput: null,
			completedSuccessfully: false,
		});
		expect(completed.score).toBeGreaterThan(notCompleted.score);
	});
});

describe("combineThreeLayerScores", () => {
	it("combines with default weights", () => {
		const combined = combineThreeLayerScores(0.8, 0.7, 0.9, false);
		// 0.8*0.2 + 0.7*0.3 + 0.9*0.5 = 0.16 + 0.21 + 0.45 = 0.82
		expect(combined).toBeCloseTo(0.82);
	});

	it("hard gate failure caps combined at 0.4", () => {
		const combined = combineThreeLayerScores(1.0, 1.0, 1.0, true);
		expect(combined).toBeLessThanOrEqual(0.4);
	});

	it("result is between 0 and 1", () => {
		expect(combineThreeLayerScores(0, 0, 0, false)).toBeGreaterThanOrEqual(0);
		expect(combineThreeLayerScores(1, 1, 1, false)).toBeLessThanOrEqual(1);
	});

	it("respects custom weights", () => {
		const combined = combineThreeLayerScores(1.0, 0.0, 0.0, false, {
			reasoning: 1.0,
			action: 0,
			outcome: 0,
		});
		expect(combined).toBeCloseTo(1.0);
	});
});
