/**
 * Trace Freezer — Freeze a live trace into an immutable behavioral snapshot.
 *
 * Freezing is required before a trace can become a:
 * - failure source
 * - dataset source
 * - regression baseline
 *
 * A frozen snapshot captures the full behavioral state at the moment of
 * freezing. The redaction pass (Phase 0B) runs before any snapshot is stored.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ReplayTier = "A" | "B" | "C";

export interface FrozenSpanSnapshot {
	spanId: string;
	name: string;
	type: string;
	input: unknown;
	output: unknown;
	durationMs: number | null;
	model: string | null;
	provider: string | null;
	temperature: number | null;
	toolCalls: FrozenToolCall[];
	messages: FrozenMessage[];
	retrievedDocuments: FrozenRetrievedDocument[];
	reasoningSegments: FrozenReasoningSegment[];
	error: { message: string; code?: string } | null;
}

export interface FrozenToolCall {
	name: string;
	arguments: Record<string, unknown>;
	output: unknown;
	success: boolean | null;
	captureMode: "full" | "hash" | "none";
}

export interface FrozenMessage {
	role: string;
	content: string;
	timestamp: string | null;
}

export interface FrozenRetrievedDocument {
	documentId: string;
	score: number | null;
	source: string | null;
	contentHash: string | null;
}

export interface FrozenReasoningSegment {
	stepIndex: number;
	type: string;
	content: string;
	confidence: number | null;
}

export interface ExternalDependency {
	name: string;
	type: "api" | "database" | "file" | "model" | "other";
	captured: boolean;
}

export interface FrozenTraceSnapshot {
	/** ID of the original trace */
	traceId: string;
	/** When this snapshot was frozen */
	frozenAt: string;
	/** Schema version of the FrozenTraceSnapshot format */
	snapshotVersion: number;
	/** Replay determinism tier based on what was captured */
	replayTier: ReplayTier;
	/** Model configuration at freeze time */
	modelConfig: {
		model: string | null;
		provider: string | null;
		temperature: number | null;
		maxTokens: number | null;
	};
	/** Git commit SHA if available (for deterministic replay) */
	commitSha: string | null;
	/** Tool output capture mode */
	toolOutputCaptureMode: "full" | "hash" | "none";
	/** External dependencies that were not captured */
	externalDeps: ExternalDependency[];
	/** Frozen span snapshots */
	spans: FrozenSpanSnapshot[];
	/** Whether redaction has been applied */
	redacted: boolean;
	/** Redaction profile ID that was applied */
	redactionProfileId: string | null;
	/** Environment at freeze time */
	environment: {
		runtime: string | null;
		sdkVersion: string | null;
		deployEnvironment: string | null;
		region: string | null;
	};
}

export const FROZEN_SNAPSHOT_VERSION = 1;

// ── Freeze options ────────────────────────────────────────────────────────────

export interface FreezeOptions {
	/** How to capture tool outputs */
	toolOutputCaptureMode?: "full" | "hash" | "none";
	/** Git commit SHA for determinism */
	commitSha?: string | null;
	/** Redaction profile to apply (null = no redaction, use with caution) */
	redactionProfileId?: string | null;
	/** Whether to apply redaction before freezing (default: true) */
	applyRedaction?: boolean;
}

// ── Raw trace input for freezing ─────────────────────────────────────────────

export interface TraceForFreezing {
	traceId: string;
	spans: Array<{
		spanId: string;
		name: string;
		type: string;
		input?: unknown;
		output?: unknown;
		durationMs?: number | null;
		metadata?: Record<string, unknown>;
		behavioral?: {
			messages?: Array<{ role: string; content: string; timestamp?: string }>;
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
				content?: string;
			}>;
			reasoningSegments?: Array<{
				stepIndex: number;
				type: string;
				content: string;
				confidence?: number;
			}>;
			error?: { message: string; code?: string };
		};
	}>;
	environment?: {
		runtime?: string;
		sdkVersion?: string;
		deployEnvironment?: string;
		region?: string;
		commitSha?: string;
	};
}

// ── Core freeze function ──────────────────────────────────────────────────────

/**
 * Freeze a live trace into an immutable behavioral snapshot.
 *
 * Steps:
 * 1. Extract model config from span metadata
 * 2. Determine replay tier based on captured data
 * 3. Snapshot all spans with their behavioral payloads
 * 4. Mark external deps that were not captured
 *
 * Note: Redaction must be applied separately via the security pipeline.
 */
export function freezeTrace(
	trace: TraceForFreezing,
	options: FreezeOptions = {},
): FrozenTraceSnapshot {
	const captureMode = options.toolOutputCaptureMode ?? "full";
	const commitSha = options.commitSha ?? trace.environment?.commitSha ?? null;

	const frozenSpans: FrozenSpanSnapshot[] = trace.spans.map((span) => {
		const meta = span.metadata ?? {};
		return {
			spanId: span.spanId,
			name: span.name,
			type: span.type,
			input: span.input ?? null,
			output: span.output ?? null,
			durationMs: span.durationMs ?? null,
			model: (meta.model as string) ?? null,
			provider: (meta.provider as string) ?? null,
			temperature: (meta.temperature as number) ?? null,
			toolCalls: (span.behavioral?.toolCalls ?? []).map((tc) => ({
				name: tc.name,
				arguments: tc.arguments,
				output: captureMode === "full" ? (tc.output ?? null) : null,
				success: tc.success ?? null,
				captureMode,
			})),
			messages: (span.behavioral?.messages ?? []).map((m) => ({
				role: m.role,
				content: m.content,
				timestamp: m.timestamp ?? null,
			})),
			retrievedDocuments: (span.behavioral?.retrievedDocuments ?? []).map(
				(d) => ({
					documentId: d.documentId,
					score: d.score ?? null,
					source: d.source ?? null,
					contentHash: null,
				}),
			),
			reasoningSegments: (span.behavioral?.reasoningSegments ?? []).map(
				(r) => ({
					stepIndex: r.stepIndex,
					type: r.type,
					content: r.content,
					confidence: r.confidence ?? null,
				}),
			),
			error: span.behavioral?.error ?? null,
		};
	});

	const externalDeps = detectExternalDeps(frozenSpans, captureMode);
	const replayTier = determineReplayTier(
		frozenSpans,
		captureMode,
		commitSha,
		externalDeps,
	);

	const firstLlmSpan = frozenSpans.find((s) => s.type === "llm");

	return {
		traceId: trace.traceId,
		frozenAt: new Date().toISOString(),
		snapshotVersion: FROZEN_SNAPSHOT_VERSION,
		replayTier,
		modelConfig: {
			model: firstLlmSpan?.model ?? null,
			provider: firstLlmSpan?.provider ?? null,
			temperature: firstLlmSpan?.temperature ?? null,
			maxTokens: null,
		},
		commitSha,
		toolOutputCaptureMode: captureMode,
		externalDeps,
		spans: frozenSpans,
		redacted: false,
		redactionProfileId: options.redactionProfileId ?? null,
		environment: {
			runtime: trace.environment?.runtime ?? null,
			sdkVersion: trace.environment?.sdkVersion ?? null,
			deployEnvironment: trace.environment?.deployEnvironment ?? null,
			region: trace.environment?.region ?? null,
		},
	};
}

// ── Replay tier classification ────────────────────────────────────────────────

/**
 * Determine replay tier based on captured data:
 * A = Deterministic: all tool outputs captured + model config + commitSha
 * B = Semi-deterministic: model inputs captured but nondeterminism possible
 * C = Best-effort: external APIs not recorded
 */
export function determineReplayTier(
	spans: FrozenSpanSnapshot[],
	captureMode: "full" | "hash" | "none",
	commitSha: string | null,
	externalDeps: ExternalDependency[],
): ReplayTier {
	const hasUncapturedDeps = externalDeps.some((d) => !d.captured);
	if (hasUncapturedDeps) return "C";

	const hasToolCalls = spans.some((s) => s.toolCalls.length > 0);
	if (hasToolCalls && captureMode !== "full") return "B";

	const hasModelConfig = spans.some(
		(s) => s.model !== null && s.temperature !== null,
	);
	if (!hasModelConfig) return "B";

	if (!commitSha) return "B";

	return "A";
}

function detectExternalDeps(
	spans: FrozenSpanSnapshot[],
	captureMode: "full" | "hash" | "none",
): ExternalDependency[] {
	const deps: ExternalDependency[] = [];

	for (const span of spans) {
		if (span.type === "retrieval") {
			deps.push({
				name: `retrieval:${span.name}`,
				type: "database",
				captured: span.retrievedDocuments.length > 0,
			});
		}

		for (const tc of span.toolCalls) {
			const alreadyTracked = deps.some((d) => d.name === `tool:${tc.name}`);
			if (!alreadyTracked) {
				deps.push({
					name: `tool:${tc.name}`,
					type: "api",
					captured: captureMode === "full" && tc.output !== null,
				});
			}
		}
	}

	return deps;
}
