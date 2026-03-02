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

// ── Version resolution ────────────────────────────────────────────────────────

/**
 * Resolve an entity at a specific version number from a history array.
 * The history array must contain all versions of the same id.
 * Returns null if the requested version does not exist.
 */
export function resolveAtVersion(
	history: ReliabilityObject[],
	targetVersion: number,
): ReliabilityObject | null {
	return history.find((obj) => obj.version === targetVersion) ?? null;
}

/**
 * Resolve the latest version of an entity that existed at or before a given
 * ISO-8601 timestamp. Useful for point-in-time audit queries.
 * Returns null if no version existed before the given timestamp.
 */
export function resolveAtTime(
	history: ReliabilityObject[],
	isoTimestamp: string,
): ReliabilityObject | null {
	const cutoff = new Date(isoTimestamp).getTime();
	if (Number.isNaN(cutoff)) return null;

	const eligible = history
		.filter((obj) => new Date(obj.provenance.createdAt).getTime() <= cutoff)
		.sort((a, b) => b.version - a.version);

	return eligible[0] ?? null;
}

/**
 * Build a sorted version history from an unsorted collection.
 * Validates that all objects share the same id + type.
 * Returns { history, valid, error }.
 */
export function buildVersionHistory(objects: ReliabilityObject[]): {
	history: ReliabilityObject[];
	valid: boolean;
	error?: string;
} {
	if (objects.length === 0) return { history: [], valid: true };

	const firstId = objects[0]!.id;
	const firstType = objects[0]!.type;

	for (const obj of objects) {
		if (obj.id !== firstId) {
			return {
				history: [],
				valid: false,
				error: `Mixed ids: ${firstId} vs ${obj.id}`,
			};
		}
		if (obj.type !== firstType) {
			return {
				history: [],
				valid: false,
				error: `Mixed types: ${firstType} vs ${obj.type}`,
			};
		}
	}

	const sorted = [...objects].sort((a, b) => a.version - b.version);

	// Validate monotonic versions (no duplicates, no gaps)
	for (let i = 0; i < sorted.length; i++) {
		if (sorted[i]!.version !== i + 1) {
			return {
				history: sorted,
				valid: false,
				error: `Version gap or duplicate at position ${i + 1} (got v${sorted[i]!.version})`,
			};
		}
	}

	return { history: sorted, valid: true };
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
