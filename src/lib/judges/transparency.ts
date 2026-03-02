/**
 * Judge Transparency Pack — Artifacts for auditable judge decisions.
 *
 * Every judge result must be explainable. This module defines the transparency
 * artifact format and the "explain view" data model surfaced in the UI.
 *
 * Stores: rubric hash, judge prompts hash, raw outputs, aggregation math,
 * agreement stats, and a human-readable explain view.
 */

import type { AggregatedJudgeResult, JudgeVote } from "./aggregation";

// ── Types ────────────────────────────────────────────────────────────────────

export interface JudgeTransparencyArtifact {
	/** Unique ID for this transparency artifact */
	id: string;
	/** The eval run this belongs to */
	evalRunId: string;
	/** The test case this scored */
	testCaseId: string;
	/** When this artifact was created */
	createdAt: string;
	/** Rubric hash (SHA-256 or content-hash reference) */
	rubricRef: string | null;
	/** Judge prompts — hashed for security, full stored separately with access control */
	promptHashes: Record<string, string>;
	/** Per-judge raw outputs (truncated to 2000 chars for storage efficiency) */
	rawOutputs: JudgeRawOutput[];
	/** Aggregation details */
	aggregation: AggregationDetails;
	/** Human-readable explain view */
	explainView: ExplainView;
}

export interface JudgeRawOutput {
	judgeId: string;
	score: number;
	rawText: string;
	truncated: boolean;
	model: string | null;
	latencyMs: number | null;
}

export interface AggregationDetails {
	strategy: string;
	finalScore: number;
	judgeCount: number;
	stdDev: number;
	consensusRatio: number;
	isHighAgreement: boolean;
	/** The mathematical formula/process used as prose */
	aggregationNarrative: string;
}

export interface ExplainView {
	/** One-line verdict summary */
	summary: string;
	/** Final score formatted as percentage */
	scoreDisplay: string;
	/** Agreement level: "strong", "moderate", "weak" */
	agreementLevel: "strong" | "moderate" | "weak";
	/** Per-judge cards for UI rendering */
	judgeCards: JudgeCard[];
	/** Flags / warnings about this result */
	flags: string[];
}

export interface JudgeCard {
	judgeId: string;
	score: number;
	scoreDisplay: string;
	reasoning: string;
	isOutlier: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function simpleHash(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

function formatScore(score: number): string {
	return `${(score * 100).toFixed(0)}%`;
}

function agreementLevel(stdDev: number): ExplainView["agreementLevel"] {
	if (stdDev <= 0.1) return "strong";
	if (stdDev <= 0.25) return "moderate";
	return "weak";
}

function isOutlier(score: number, finalScore: number, stdDev: number): boolean {
	return Math.abs(score - finalScore) > stdDev * 2;
}

function buildAggregationNarrative(result: AggregatedJudgeResult): string {
	const scores = result.votes
		.map((v) => `${v.judgeId}=${formatScore(v.score)}`)
		.join(", ");
	return `Strategy: ${result.strategy}. Votes: [${scores}]. Final: ${formatScore(result.finalScore)}. Std dev: ${result.agreementStats.stdDev.toFixed(3)}. Consensus ratio: ${(result.agreementStats.consensusRatio * 100).toFixed(0)}%.`;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface CreateTransparencyArtifactInput {
	id: string;
	evalRunId: string;
	testCaseId: string;
	rubricText?: string | null;
	judgePrompts?: Record<string, string>;
	rawOutputs: Array<{
		judgeId: string;
		score: number;
		rawText: string;
		model?: string | null;
		latencyMs?: number | null;
	}>;
	aggregationResult: AggregatedJudgeResult;
}

/**
 * Build a JudgeTransparencyArtifact from aggregation results.
 */
export function createTransparencyArtifact(
	input: CreateTransparencyArtifactInput,
): JudgeTransparencyArtifact {
	const MAX_OUTPUT_LENGTH = 2000;

	const promptHashes: Record<string, string> = {};
	for (const [judgeId, prompt] of Object.entries(input.judgePrompts ?? {})) {
		promptHashes[judgeId] = simpleHash(prompt);
	}

	const rawOutputs: JudgeRawOutput[] = input.rawOutputs.map((o) => ({
		judgeId: o.judgeId,
		score: o.score,
		rawText:
			o.rawText.length > MAX_OUTPUT_LENGTH
				? `${o.rawText.slice(0, MAX_OUTPUT_LENGTH)}…`
				: o.rawText,
		truncated: o.rawText.length > MAX_OUTPUT_LENGTH,
		model: o.model ?? null,
		latencyMs: o.latencyMs ?? null,
	}));

	const result = input.aggregationResult;
	const flags: string[] = [];

	if (!result.highConfidence) flags.push("low-confidence");
	if (!result.agreementStats.isHighAgreement) flags.push("low-agreement");
	if (result.judgeCount === 1) flags.push("single-judge");
	if (result.agreementStats.range > 0.5) flags.push("high-score-range");

	const judgeCards: JudgeCard[] = result.votes.map((v: JudgeVote) => ({
		judgeId: v.judgeId,
		score: v.score,
		scoreDisplay: formatScore(v.score),
		reasoning: v.reasoning ?? "No reasoning provided",
		isOutlier: isOutlier(
			v.score,
			result.finalScore,
			result.agreementStats.stdDev,
		),
	}));

	const level = agreementLevel(result.agreementStats.stdDev);
	const summary = flags.includes("low-confidence")
		? `Result uncertain — ${result.judgeCount} judge(s), ${level} agreement`
		: `${formatScore(result.finalScore)} — ${result.judgeCount} judge(s), ${level} agreement`;

	return {
		id: input.id,
		evalRunId: input.evalRunId,
		testCaseId: input.testCaseId,
		createdAt: new Date().toISOString(),
		rubricRef: input.rubricText ? simpleHash(input.rubricText) : null,
		promptHashes,
		rawOutputs,
		aggregation: {
			strategy: result.strategy,
			finalScore: result.finalScore,
			judgeCount: result.judgeCount,
			stdDev: result.agreementStats.stdDev,
			consensusRatio: result.agreementStats.consensusRatio,
			isHighAgreement: result.agreementStats.isHighAgreement,
			aggregationNarrative: buildAggregationNarrative(result),
		},
		explainView: {
			summary,
			scoreDisplay: formatScore(result.finalScore),
			agreementLevel: level,
			judgeCards,
			flags,
		},
	};
}
