/**
 * Trace Feature Extractor — Extract structured features from a frozen trace.
 *
 * Features feed the three-layer scoring model (reasoning/action/outcome).
 * Results are intended to be cached in the trace_features table.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TraceSpanForExtraction {
	spanId: string;
	name: string;
	type: string;
	input?: unknown;
	output?: unknown;
	durationMs?: number | null;
	metadata?: Record<string, unknown>;
	behavioral?: {
		messages?: Array<{ role: string; content: string }>;
		toolCalls?: Array<{
			name: string;
			arguments: Record<string, unknown>;
			output?: unknown;
			success?: boolean;
		}>;
		retrievedDocuments?: Array<{
			documentId: string;
			score?: number;
			source?: string;
		}>;
		reasoningSegments?: Array<{
			stepIndex: number;
			type: string;
			content: string;
			confidence?: number;
		}>;
		error?: { message: string; code?: string } | null;
	};
}

export interface ToolGraphNode {
	name: string;
	callCount: number;
	successRate: number | null;
	avgOutputSize: number;
}

export interface ReasoningTokens {
	totalSegments: number;
	segmentsByType: Record<string, number>;
	avgConfidence: number | null;
	hasChainOfThought: boolean;
	hasSelfCritique: boolean;
}

export interface ActionTimeline {
	steps: Array<{ type: string; name: string; success: boolean | null }>;
	totalTools: number;
	totalLlmCalls: number;
	errorCount: number;
}

export interface TraceFeatures {
	/** Tool call graph summary */
	toolGraph: ToolGraphNode[];
	/** Reasoning segment analysis */
	reasoningTokens: ReasoningTokens;
	/** Action timeline */
	actionTimeline: ActionTimeline;
	/** Whether the trace ended with an error */
	hadError: boolean;
	/** Total cost (USD) if available */
	totalCostUsd: number | null;
	/** Total token count if available */
	totalTokens: number | null;
	/** Number of retrieved documents */
	retrievalCount: number;
	/** Feature extraction algorithm version */
	featureVersion: string;
}

export const FEATURE_VERSION = "v1";

// ── Extractor ─────────────────────────────────────────────────────────────────

/**
 * Extract structured features from a list of spans.
 */
export function extractTraceFeatures(
	spans: TraceSpanForExtraction[],
): TraceFeatures {
	const toolCallMap = new Map<
		string,
		{ total: number; successes: number; outputSizes: number[] }
	>();
	const timelineSteps: ActionTimeline["steps"] = [];
	const allReasoningSegments: Array<{ type: string; confidence?: number }> = [];
	let hadError = false;
	let totalCostUsd = 0;
	let totalTokens = 0;
	let retrievalCount = 0;
	let _hasReasoningData = false;

	for (const span of spans) {
		// Error detection
		if (span.behavioral?.error) hadError = true;

		// Metadata extraction
		const meta = span.metadata ?? {};
		if (typeof meta.cost === "number") totalCostUsd += meta.cost;
		if (typeof meta.tokenCount === "number") totalTokens += meta.tokenCount;

		// Tool call graph
		for (const tc of span.behavioral?.toolCalls ?? []) {
			const existing = toolCallMap.get(tc.name) ?? {
				total: 0,
				successes: 0,
				outputSizes: [],
			};
			existing.total++;
			if (tc.success === true) existing.successes++;
			if (tc.output !== undefined) {
				const size =
					typeof tc.output === "string"
						? tc.output.length
						: JSON.stringify(tc.output ?? "").length;
				existing.outputSizes.push(size);
			}
			toolCallMap.set(tc.name, existing);

			timelineSteps.push({
				type: "tool",
				name: tc.name,
				success: tc.success ?? null,
			});
		}

		// Reasoning segments
		for (const seg of span.behavioral?.reasoningSegments ?? []) {
			allReasoningSegments.push({ type: seg.type, confidence: seg.confidence });
			_hasReasoningData = true;
		}

		// Retrieval
		retrievalCount += span.behavioral?.retrievedDocuments?.length ?? 0;

		// LLM call
		if (span.type === "llm" || span.type === "chat") {
			timelineSteps.push({
				type: "llm",
				name: span.name,
				success: !span.behavioral?.error,
			});
		}
	}

	// Build tool graph
	const toolGraph: ToolGraphNode[] = [];
	for (const [name, stats] of toolCallMap) {
		toolGraph.push({
			name,
			callCount: stats.total,
			successRate: stats.total > 0 ? stats.successes / stats.total : null,
			avgOutputSize:
				stats.outputSizes.length > 0
					? stats.outputSizes.reduce((a, b) => a + b, 0) /
						stats.outputSizes.length
					: 0,
		});
	}

	// Build reasoning tokens
	const segmentsByType: Record<string, number> = {};
	let confidenceSum = 0;
	let confidenceCount = 0;
	for (const seg of allReasoningSegments) {
		segmentsByType[seg.type] = (segmentsByType[seg.type] ?? 0) + 1;
		if (seg.confidence !== undefined) {
			confidenceSum += seg.confidence;
			confidenceCount++;
		}
	}

	const reasoningTokens: ReasoningTokens = {
		totalSegments: allReasoningSegments.length,
		segmentsByType,
		avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
		hasChainOfThought: (segmentsByType.chain_of_thought ?? 0) > 0,
		hasSelfCritique: (segmentsByType.self_critique ?? 0) > 0,
	};

	const errorCount = timelineSteps.filter((s) => s.success === false).length;

	return {
		toolGraph,
		reasoningTokens,
		actionTimeline: {
			steps: timelineSteps,
			totalTools: timelineSteps.filter((s) => s.type === "tool").length,
			totalLlmCalls: timelineSteps.filter((s) => s.type === "llm").length,
			errorCount,
		},
		hadError,
		totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
		totalTokens: totalTokens > 0 ? totalTokens : null,
		retrievalCount,
		featureVersion: FEATURE_VERSION,
	};
}
