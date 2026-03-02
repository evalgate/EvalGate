/**
 * ReliabilityObject — The foundational identity + version + lineage primitive.
 *
 * Every versionable entity in EvalGate (trace, dataset, metric, judge, failure,
 * baseline) must implement this contract. It is the single mechanism that makes
 * drift alerts, audit trails, and baselines trustworthy across time.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export const ReliabilityObjectType = {
	TRACE: "trace",
	DATASET: "dataset",
	METRIC: "metric",
	JUDGE: "judge",
	FAILURE: "failure",
	BASELINE: "baseline",
	TEST_CASE: "test_case",
	EVAL_RUN: "eval_run",
} as const;

export type ReliabilityObjectType =
	(typeof ReliabilityObjectType)[keyof typeof ReliabilityObjectType];

export interface Provenance {
	/** Who created / mutated the entity */
	actorId: string | null;
	/** System component that performed the write */
	source: string;
	/** ISO-8601 timestamp of this version's creation */
	createdAt: string;
	/** Human-readable reason for this version */
	reason?: string;
	/** Correlation ID for the originating request */
	requestId?: string;
}

export interface ReliabilityObject {
	/** Globally unique identifier (UUID or content-addressable hash) */
	id: string;
	/** Entity type */
	type: ReliabilityObjectType;
	/** Monotonically increasing version number (per entity, starts at 1) */
	version: number;
	/** Version of the parent this was derived from, null for v1 */
	parentVersion: number | null;
	/** Source reference that caused this entity to be created */
	createdFrom: string | null;
	/** Schema version of the ReliabilityObject format itself */
	specVersion: number;
	/** Provenance chain */
	provenance: Provenance;
}

// ── Current spec version ─────────────────────────────────────────────────────

export const RELIABILITY_SPEC_VERSION = 1;

// ── Factory ──────────────────────────────────────────────────────────────────

export interface CreateReliabilityObjectInput {
	id: string;
	type: ReliabilityObjectType;
	actorId?: string | null;
	source: string;
	createdFrom?: string | null;
	reason?: string;
	requestId?: string;
}

/**
 * Create a brand-new v1 ReliabilityObject for a newly created entity.
 */
export function createReliabilityObject(
	input: CreateReliabilityObjectInput,
): ReliabilityObject {
	return {
		id: input.id,
		type: input.type,
		version: 1,
		parentVersion: null,
		createdFrom: input.createdFrom ?? null,
		specVersion: RELIABILITY_SPEC_VERSION,
		provenance: {
			actorId: input.actorId ?? null,
			source: input.source,
			createdAt: new Date().toISOString(),
			reason: input.reason,
			requestId: input.requestId,
		},
	};
}

/**
 * Derive a new ReliabilityObject version from an existing one.
 * Increments version and sets parentVersion.
 */
export function bumpReliabilityVersion(
	existing: ReliabilityObject,
	update: {
		actorId?: string | null;
		source: string;
		reason?: string;
		requestId?: string;
	},
): ReliabilityObject {
	return {
		...existing,
		version: existing.version + 1,
		parentVersion: existing.version,
		specVersion: RELIABILITY_SPEC_VERSION,
		provenance: {
			actorId: update.actorId ?? null,
			source: update.source,
			createdAt: new Date().toISOString(),
			reason: update.reason,
			requestId: update.requestId,
		},
	};
}

/**
 * Type guard to check if an unknown value is a ReliabilityObject.
 */
export function isReliabilityObject(
	value: unknown,
): value is ReliabilityObject {
	if (typeof value !== "object" || value === null) return false;
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.type === "string" &&
		typeof obj.version === "number" &&
		typeof obj.specVersion === "number" &&
		typeof obj.provenance === "object"
	);
}
