/**
 * VersionResolver — Resolve any entity to its state at a given version or timestamp.
 *
 * Provides point-in-time lookup for ReliabilityObjects, enabling
 * "what did this metric look like when this regression was filed?" queries.
 */

import type {
	ReliabilityObject,
	ReliabilityObjectType,
} from "./reliability-object";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VersionedEntity {
	id: string;
	type: ReliabilityObjectType;
	version: number;
	createdAt: string;
	data: Record<string, unknown>;
	reliability: ReliabilityObject;
}

export interface ResolveByVersionInput {
	entityId: string;
	version: number;
}

export interface ResolveByTimestampInput {
	entityId: string;
	/** ISO-8601 timestamp — resolve to the latest version that existed at or before this time */
	atOrBefore: string;
}

export type ResolveResult =
	| { found: true; entity: VersionedEntity }
	| { found: false; reason: string };

// ── In-memory store (to be backed by DB in production) ───────────────────────

/**
 * VersionResolver manages a registry of versioned entities and provides
 * point-in-time resolution. In production, the `lookup` function is replaced
 * with a DB query.
 */
export class VersionResolver {
	private store: Map<string, VersionedEntity[]> = new Map();

	/**
	 * Register a versioned entity snapshot. Called on every write.
	 */
	register(entity: VersionedEntity): void {
		const existing = this.store.get(entity.id) ?? [];
		const alreadyRegistered = existing.some(
			(e) => e.version === entity.version,
		);
		if (!alreadyRegistered) {
			existing.push(entity);
			existing.sort((a, b) => a.version - b.version);
		}
		this.store.set(entity.id, existing);
	}

	/**
	 * Resolve an entity at an exact version number.
	 */
	resolveByVersion(input: ResolveByVersionInput): ResolveResult {
		const versions = this.store.get(input.entityId);
		if (!versions || versions.length === 0) {
			return { found: false, reason: `Entity ${input.entityId} not found` };
		}

		const entity = versions.find((e) => e.version === input.version);
		if (!entity) {
			return {
				found: false,
				reason: `Entity ${input.entityId} version ${input.version} not found`,
			};
		}

		return { found: true, entity };
	}

	/**
	 * Resolve an entity to the latest version that existed at or before a timestamp.
	 */
	resolveByTimestamp(input: ResolveByTimestampInput): ResolveResult {
		const versions = this.store.get(input.entityId);
		if (!versions || versions.length === 0) {
			return { found: false, reason: `Entity ${input.entityId} not found` };
		}

		const atMs = new Date(input.atOrBefore).getTime();
		const eligible = versions.filter(
			(e) => new Date(e.createdAt).getTime() <= atMs,
		);

		if (eligible.length === 0) {
			return {
				found: false,
				reason: `No version of ${input.entityId} existed at ${input.atOrBefore}`,
			};
		}

		const entity = eligible[eligible.length - 1]!;
		return { found: true, entity };
	}

	/**
	 * Get all registered versions for an entity, oldest first.
	 */
	listVersions(entityId: string): VersionedEntity[] {
		return this.store.get(entityId) ?? [];
	}

	/**
	 * Get the latest version of an entity.
	 */
	resolveLatest(entityId: string): ResolveResult {
		const versions = this.store.get(entityId);
		if (!versions || versions.length === 0) {
			return { found: false, reason: `Entity ${entityId} not found` };
		}
		return { found: true, entity: versions[versions.length - 1]! };
	}

	/**
	 * Clear all registered entities (for testing).
	 */
	clear(): void {
		this.store.clear();
	}
}

/** Singleton resolver for application-wide use */
export const globalVersionResolver = new VersionResolver();
