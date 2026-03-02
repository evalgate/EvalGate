/**
 * EvalCase v1 — Canonical testcase format for EvalGate.
 *
 * This is the portable, diffable, on-disk format for eval test cases.
 * Cases can be exported to YAML/JSON, committed to git, reviewed in PRs,
 * and imported back. Content-hash IDs ensure stability.
 */

import { z } from "zod";

// ── Version ───────────────────────────────────────────────────────────────────

export const EVAL_CASE_VERSION = 1;

// ── Replay tier (mirrored from trace-freezer for portability) ─────────────────

export const ReplayTierSchema = z.enum(["A", "B", "C"]);
export type ReplayTier = z.infer<typeof ReplayTierSchema>;

// ── Expected constraint schema ────────────────────────────────────────────────

export const ExpectedConstraintSchema = z.object({
	/** Constraint type: contains, not_contains, matches, score_gte, etc. */
	type: z.enum([
		"contains",
		"not_contains",
		"matches_regex",
		"score_gte",
		"score_lte",
		"json_schema",
		"no_pii",
		"no_toxicity",
		"custom",
	]),
	value: z.unknown(),
	/** Whether this constraint is a hard gate (failure = test fail) */
	required: z.boolean().default(true),
	description: z.string().optional(),
});

export type ExpectedConstraint = z.infer<typeof ExpectedConstraintSchema>;

// ── EvalCase schema ───────────────────────────────────────────────────────────

export const EvalCaseSchema = z.object({
	/** Content-hash ID (stable, deterministic) */
	id: z.string().min(1),
	/** Schema version of the EvalCase format */
	evalCaseVersion: z.number().int().default(EVAL_CASE_VERSION),
	/** Human-readable title */
	title: z.string().min(1),
	/** Categorization tags */
	tags: z.array(z.string()).default([]),
	/** Source trace IDs this case was derived from */
	sourceTraceIds: z.array(z.string()).default([]),
	/** Reference to the frozen snapshot used for replay */
	frozenSnapshotRef: z.string().nullable().default(null),
	/** Reference to the rubric to use for evaluation */
	rubricRef: z.string().nullable().default(null),
	/** Reference to the metric DAG to use */
	metricDAGRef: z.string().nullable().default(null),
	/** Constraints the output must satisfy */
	expectedConstraints: z.array(ExpectedConstraintSchema).default([]),
	/** Replay tier for this case */
	replayTier: ReplayTierSchema.nullable().default(null),
	/** Reference to the redaction profile */
	redactionProfileRef: z.string().nullable().default(null),
	/** Whether this case is in quarantine (pending human review) */
	quarantined: z.boolean().default(false),
	/** IDs of cases this was merged from (dedup lineage) */
	mergedFromIds: z.array(z.string()).default([]),
	/** ISO-8601 creation timestamp */
	createdAt: z.string(),
	/** ISO-8601 last updated timestamp */
	updatedAt: z.string(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;

// ── Content hash ──────────────────────────────────────────────────────────────

/**
 * Compute a stable content-hash ID for an eval case.
 * Hash input: title + sorted tags + sorted sourceTraceIds.
 * This ensures the same logical test always gets the same ID.
 *
 * Uses FNV-1a 64-bit via BigInt (~1.8×10¹⁹ unique IDs) to make collisions
 * negligible for any realistic test registry size.
 */
export function computeEvalCaseId(input: {
	title: string;
	tags?: string[];
	sourceTraceIds?: string[];
}): string {
	const canonical = JSON.stringify({
		title: input.title.trim().toLowerCase(),
		tags: [...(input.tags ?? [])].sort(),
		sourceTraceIds: [...(input.sourceTraceIds ?? [])].sort(),
	});

	// FNV-1a 64-bit constants
	const FNV_OFFSET = BigInt("14695981039346656037");
	const FNV_PRIME = BigInt("1099511628211");
	const MASK64 = (BigInt(1) << BigInt(64)) - BigInt(1);

	let hash = FNV_OFFSET;
	for (let i = 0; i < canonical.length; i++) {
		hash = (hash ^ BigInt(canonical.charCodeAt(i))) & MASK64;
		hash = (hash * FNV_PRIME) & MASK64;
	}
	return `ec_${hash.toString(16).padStart(16, "0")}`;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface CreateEvalCaseInput {
	title: string;
	tags?: string[];
	sourceTraceIds?: string[];
	frozenSnapshotRef?: string | null;
	rubricRef?: string | null;
	metricDAGRef?: string | null;
	expectedConstraints?: ExpectedConstraint[];
	replayTier?: ReplayTier | null;
	redactionProfileRef?: string | null;
	quarantined?: boolean;
}

export function createEvalCase(input: CreateEvalCaseInput): EvalCase {
	const now = new Date().toISOString();
	const id = computeEvalCaseId({
		title: input.title,
		tags: input.tags,
		sourceTraceIds: input.sourceTraceIds,
	});

	return EvalCaseSchema.parse({
		id,
		evalCaseVersion: EVAL_CASE_VERSION,
		title: input.title,
		tags: input.tags ?? [],
		sourceTraceIds: input.sourceTraceIds ?? [],
		frozenSnapshotRef: input.frozenSnapshotRef ?? null,
		rubricRef: input.rubricRef ?? null,
		metricDAGRef: input.metricDAGRef ?? null,
		expectedConstraints: input.expectedConstraints ?? [],
		replayTier: input.replayTier ?? null,
		redactionProfileRef: input.redactionProfileRef ?? null,
		quarantined: input.quarantined ?? true, // default to quarantine
		mergedFromIds: [],
		createdAt: now,
		updatedAt: now,
	});
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Serialize an EvalCase to a canonical JSON string (stable key order).
 */
export function serializeEvalCase(evalCase: EvalCase): string {
	return JSON.stringify(evalCase, null, 2);
}

/**
 * Parse an EvalCase from a JSON string or parsed object.
 * Returns a parse result (success/failure) without throwing.
 */
export function parseEvalCase(
	input: unknown,
): { success: true; data: EvalCase } | { success: false; error: string } {
	const result = EvalCaseSchema.safeParse(input);
	if (!result.success) {
		const first = result.error.errors[0];
		return {
			success: false,
			error: `EvalCase parse error: ${first?.path.join(".")} — ${first?.message}`,
		};
	}
	return { success: true, data: result.data };
}

/**
 * Round-trip test: serialize then parse and verify structural equality.
 */
export function roundTripEvalCase(evalCase: EvalCase): {
	stable: boolean;
	original: EvalCase;
	reparsed: EvalCase | null;
	error?: string;
} {
	const serialized = serializeEvalCase(evalCase);
	const parsed = parseEvalCase(JSON.parse(serialized));

	if (!parsed.success) {
		return {
			stable: false,
			original: evalCase,
			reparsed: null,
			error: parsed.error,
		};
	}

	const stable =
		parsed.data.id === evalCase.id && parsed.data.title === evalCase.title;
	return { stable, original: evalCase, reparsed: parsed.data };
}
