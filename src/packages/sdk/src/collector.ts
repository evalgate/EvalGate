/**
 * SDK helper for reporting traces to the collector endpoint.
 *
 * Usage:
 *   import { reportTrace } from '@evalgate/sdk';
 *   await reportTrace(client, { ... });
 *
 * Supports:
 *   - Client-side sampling (sampleRate)
 *   - Error traces always sent
 *   - Thumbs-down feedback always sent
 */

import type { AIEvalClient } from "./client";

export interface CollectorSpanInput {
	span_id: string;
	type?: "llm" | "tool" | "agent" | "retrieval" | "default";
	name: string;
	parent_span_id?: string;
	input?: unknown;
	output?: unknown;
	model?: string;
	vendor?: string;
	params?: Record<string, unknown>;
	metrics?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_time_ms?: number;
	};
	timestamps?: {
		started_at: number;
		finished_at: number;
	};
	error?: { message: string; code?: string } | null;
	behavioral?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

export interface CollectorFeedbackInput {
	type: "thumbs_up" | "thumbs_down" | "rating" | "comment";
	value?: unknown;
	user_id?: string;
}

export interface ReportTraceInput {
	trace_id: string;
	name: string;
	status?: "pending" | "success" | "error";
	duration_ms?: number;
	source?: "sdk" | "api" | "cli";
	environment?: "production" | "staging" | "dev";
	metadata?: Record<string, unknown>;
	spans: CollectorSpanInput[];
	user_feedback?: CollectorFeedbackInput;
}

export interface ReportTraceOptions {
	/** Client-side sample rate (0-1). Default: 1.0 (send all). */
	sampleRate?: number;
}

export interface ReportTraceResult {
	sent: boolean;
	trace_id: string;
	trace_db_id?: number;
	span_count?: number;
	queued_for_analysis?: boolean;
	skip_reason?: "sampled_out";
}

/**
 * Report a production trace to the collector endpoint.
 *
 * Client-side sampling: set `options.sampleRate` (0-1).
 * Error traces and thumbs-down feedback bypass sampling.
 */
export async function reportTrace(
	client: AIEvalClient,
	input: ReportTraceInput,
	options: ReportTraceOptions = {},
): Promise<ReportTraceResult> {
	const { sampleRate = 1.0 } = options;

	// Client-side sampling — errors and thumbs-down always pass through
	const isError = input.status === "error";
	const isNegativeFeedback = input.user_feedback?.type === "thumbs_down";
	const bypassSampling = isError || isNegativeFeedback;

	if (!bypassSampling && sampleRate < 1.0) {
		if (Math.random() >= sampleRate) {
			return {
				sent: false,
				trace_id: input.trace_id,
				skip_reason: "sampled_out",
			};
		}
	}

	// Use the client's internal fetch to POST to /api/collector
	const response = await (client as any).request("/api/collector", {
		method: "POST",
		body: JSON.stringify(input),
	});

	return {
		sent: true,
		trace_id: input.trace_id,
		trace_db_id: response.trace_db_id,
		span_count: response.span_count,
		queued_for_analysis: response.queued_for_analysis,
	};
}
