import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveAutoWorkspacePaths } from "./auto-ledger";
import type { EvaluationManifest, Spec } from "./manifest";

export const AUTO_HOLDOUT_SCHEMA_VERSION = 1;

export type AutoHoldoutSelectionMode = "deterministic" | "stratified";

export interface AutoHoldoutConfig {
	selection: AutoHoldoutSelectionMode;
	lockedAfter: number | null;
	count: number | null;
	ratio: number | null;
	seed: string;
	excludedSpecIds: string[];
}

export interface AutoHoldoutSelectionResult {
	selectionRequested: AutoHoldoutSelectionMode;
	selectionUsed: AutoHoldoutSelectionMode;
	specIds: string[];
	strata: Record<string, number>;
	candidateSpecIds: string[];
}

export interface AutoHoldoutArtifact {
	schemaVersion: number;
	createdAt: string;
	selectionRequested: AutoHoldoutSelectionMode;
	selectionUsed: AutoHoldoutSelectionMode;
	lockedAfter: number | null;
	seed: string;
	manifestGeneratedAt: number | null;
	manifestSpecCount: number;
	excludedSpecIds: string[];
	specIds: string[];
	strata: Record<string, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function assertString(
	value: unknown,
	fieldName: string,
): asserts value is string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${fieldName} must be a non-empty string`);
	}
}

function assertStringArray(
	value: unknown,
	fieldName: string,
): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be an array of strings`);
	}
	for (const entry of value) {
		assertString(entry, fieldName);
	}
}

function stableRank(seed: string, specId: string): string {
	return crypto
		.createHash("sha256")
		.update(`${seed}\0${specId}`, "utf8")
		.digest("hex");
}

function sortSpecsDeterministically(specs: Spec[], seed: string): Spec[] {
	return [...specs].sort((left, right) => {
		const leftRank = stableRank(seed, left.id);
		const rightRank = stableRank(seed, right.id);
		if (leftRank < rightRank) return -1;
		if (leftRank > rightRank) return 1;
		return left.id.localeCompare(right.id);
	});
}

function resolveStratum(spec: Spec): string {
	if (spec.suitePath.length > 0 && spec.suitePath[0]?.trim()) {
		return spec.suitePath[0];
	}
	if (spec.tags.length > 0 && spec.tags[0]?.trim()) {
		return spec.tags[0];
	}
	const fileParts = spec.filePath.split("/");
	return fileParts.length > 1 ? fileParts[0] : "general";
}

function resolveHoldoutCount(
	totalCandidates: number,
	config: AutoHoldoutConfig,
): number {
	if (totalCandidates <= 1) {
		return Math.max(0, totalCandidates);
	}
	if (config.count !== null) {
		return Math.min(totalCandidates - 1, Math.max(1, config.count));
	}
	const ratio = config.ratio ?? 0.2;
	const requested = Math.ceil(totalCandidates * ratio);
	return Math.min(totalCandidates - 1, Math.max(1, requested));
}

function allocateStratifiedCounts(
	groups: Array<{ key: string; specs: Spec[] }>,
	targetCount: number,
): Map<string, number> {
	const allocations = new Map<string, number>();
	const total = groups.reduce((sum, group) => sum + group.specs.length, 0);
	let assigned = 0;
	const remainders: Array<{
		key: string;
		remainder: number;
		capacity: number;
	}> = [];

	for (const group of groups) {
		const raw = (group.specs.length / total) * targetCount;
		const base = Math.min(group.specs.length, Math.floor(raw));
		allocations.set(group.key, base);
		assigned += base;
		remainders.push({
			key: group.key,
			remainder: raw - base,
			capacity: group.specs.length,
		});
	}

	for (const group of groups) {
		if (assigned >= targetCount) {
			break;
		}
		const current = allocations.get(group.key) ?? 0;
		if (current === 0 && group.specs.length > 0) {
			allocations.set(group.key, 1);
			assigned += 1;
		}
	}

	const rankedRemainders = remainders.sort((left, right) => {
		if (right.remainder !== left.remainder) {
			return right.remainder - left.remainder;
		}
		return left.key.localeCompare(right.key);
	});

	while (assigned < targetCount) {
		let progressed = false;
		for (const group of rankedRemainders) {
			if (assigned >= targetCount) {
				break;
			}
			const current = allocations.get(group.key) ?? 0;
			if (current < group.capacity) {
				allocations.set(group.key, current + 1);
				assigned += 1;
				progressed = true;
			}
		}
		if (!progressed) {
			break;
		}
	}

	for (const group of groups) {
		const current = allocations.get(group.key) ?? 0;
		allocations.set(group.key, Math.min(current, group.specs.length));
	}

	return allocations;
}

export function parseAutoHoldoutConfig(value: unknown): AutoHoldoutConfig {
	if (!isRecord(value)) {
		throw new Error("holdout config must be an object");
	}

	const selectionValue = value.selection;
	const selection: AutoHoldoutSelectionMode =
		selectionValue === undefined
			? "deterministic"
			: selectionValue === "deterministic" || selectionValue === "stratified"
				? selectionValue
				: (() => {
						throw new Error(
							"holdout.selection must be 'deterministic' or 'stratified'",
						);
					})();

	const lockedAfterValue = value.locked_after;
	let lockedAfter: number | null = null;
	if (lockedAfterValue !== undefined && lockedAfterValue !== null) {
		if (
			!isFiniteNumber(lockedAfterValue) ||
			!Number.isInteger(lockedAfterValue) ||
			lockedAfterValue < 1
		) {
			throw new Error(
				"holdout.locked_after must be a positive integer when provided",
			);
		}
		lockedAfter = lockedAfterValue;
	}

	const countValue = value.count;
	let count: number | null = null;
	if (countValue !== undefined && countValue !== null) {
		if (
			!isFiniteNumber(countValue) ||
			!Number.isInteger(countValue) ||
			countValue < 1
		) {
			throw new Error("holdout.count must be a positive integer when provided");
		}
		count = countValue;
	}

	const ratioValue = value.ratio;
	let ratio: number | null = null;
	if (ratioValue !== undefined && ratioValue !== null) {
		if (!isFiniteNumber(ratioValue) || ratioValue <= 0 || ratioValue >= 1) {
			throw new Error(
				"holdout.ratio must be a number between 0 and 1 when provided",
			);
		}
		ratio = ratioValue;
	}

	const seedValue = value.seed;
	const seed =
		seedValue === undefined || seedValue === null
			? "evalgate-auto-holdout-v1"
			: (() => {
					assertString(seedValue, "holdout.seed");
					return seedValue;
				})();

	const excludedSpecIdsValue = value.excluded_spec_ids;
	const excludedSpecIds =
		excludedSpecIdsValue === undefined || excludedSpecIdsValue === null
			? []
			: (() => {
					assertStringArray(excludedSpecIdsValue, "holdout.excluded_spec_ids");
					return [...new Set(excludedSpecIdsValue)].sort((left, right) =>
						left.localeCompare(right),
					);
				})();

	return {
		selection,
		lockedAfter,
		count,
		ratio,
		seed,
		excludedSpecIds,
	};
}

export function selectAutoHoldoutSpecs(
	manifest: EvaluationManifest,
	config: AutoHoldoutConfig,
): AutoHoldoutSelectionResult {
	const excludedIds = new Set(config.excludedSpecIds);
	const candidates = manifest.specs.filter((spec) => !excludedIds.has(spec.id));
	const targetCount = resolveHoldoutCount(candidates.length, config);
	if (targetCount === 0) {
		return {
			selectionRequested: config.selection,
			selectionUsed: "deterministic",
			specIds: [],
			strata: {},
			candidateSpecIds: candidates
				.map((spec) => spec.id)
				.sort((left, right) => left.localeCompare(right)),
		};
	}

	const grouped = new Map<string, Spec[]>();
	for (const spec of candidates) {
		const key = resolveStratum(spec);
		const group = grouped.get(key);
		if (group) {
			group.push(spec);
		} else {
			grouped.set(key, [spec]);
		}
	}

	const groups = [...grouped.entries()]
		.map(([key, specs]) => ({
			key,
			specs: sortSpecsDeterministically(specs, config.seed),
		}))
		.sort((left, right) => left.key.localeCompare(right.key));

	const canStratify = config.selection === "stratified" && groups.length > 1;
	if (!canStratify) {
		const selected = sortSpecsDeterministically(candidates, config.seed).slice(
			0,
			targetCount,
		);
		return {
			selectionRequested: config.selection,
			selectionUsed: "deterministic",
			specIds: selected.map((spec) => spec.id),
			strata: {},
			candidateSpecIds: candidates
				.map((spec) => spec.id)
				.sort((left, right) => left.localeCompare(right)),
		};
	}

	const allocations = allocateStratifiedCounts(groups, targetCount);
	const selectedSpecs: Spec[] = [];
	const strata: Record<string, number> = {};
	for (const group of groups) {
		const allocation = allocations.get(group.key) ?? 0;
		if (allocation <= 0) {
			continue;
		}
		strata[group.key] = allocation;
		selectedSpecs.push(...group.specs.slice(0, allocation));
	}

	const selected = sortSpecsDeterministically(selectedSpecs, config.seed).slice(
		0,
		targetCount,
	);
	return {
		selectionRequested: config.selection,
		selectionUsed: "stratified",
		specIds: selected.map((spec) => spec.id),
		strata,
		candidateSpecIds: candidates
			.map((spec) => spec.id)
			.sort((left, right) => left.localeCompare(right)),
	};
}

export function createAutoHoldoutArtifact(
	manifest: EvaluationManifest,
	config: AutoHoldoutConfig,
): AutoHoldoutArtifact {
	const selection = selectAutoHoldoutSpecs(manifest, config);
	return {
		schemaVersion: AUTO_HOLDOUT_SCHEMA_VERSION,
		createdAt: new Date().toISOString(),
		selectionRequested: selection.selectionRequested,
		selectionUsed: selection.selectionUsed,
		lockedAfter: config.lockedAfter,
		seed: config.seed,
		manifestGeneratedAt: manifest.generatedAt ?? null,
		manifestSpecCount: manifest.specs.length,
		excludedSpecIds: [...config.excludedSpecIds],
		specIds: selection.specIds,
		strata: selection.strata,
	};
}

export function assertValidAutoHoldoutArtifact(
	value: unknown,
	fieldName = "holdout",
): asserts value is AutoHoldoutArtifact {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	if (value.schemaVersion !== AUTO_HOLDOUT_SCHEMA_VERSION) {
		throw new Error(
			`${fieldName}.schemaVersion must equal ${AUTO_HOLDOUT_SCHEMA_VERSION}`,
		);
	}
	assertString(value.createdAt, `${fieldName}.createdAt`);
	if (
		value.selectionRequested !== "deterministic" &&
		value.selectionRequested !== "stratified"
	) {
		throw new Error(
			`${fieldName}.selectionRequested must be 'deterministic' or 'stratified'`,
		);
	}
	if (
		value.selectionUsed !== "deterministic" &&
		value.selectionUsed !== "stratified"
	) {
		throw new Error(
			`${fieldName}.selectionUsed must be 'deterministic' or 'stratified'`,
		);
	}
	if (value.lockedAfter !== null && value.lockedAfter !== undefined) {
		if (
			!isFiniteNumber(value.lockedAfter) ||
			!Number.isInteger(value.lockedAfter) ||
			value.lockedAfter < 1
		) {
			throw new Error(
				`${fieldName}.lockedAfter must be a positive integer or null`,
			);
		}
	}
	assertString(value.seed, `${fieldName}.seed`);
	if (
		value.manifestGeneratedAt !== null &&
		value.manifestGeneratedAt !== undefined &&
		!isFiniteNumber(value.manifestGeneratedAt)
	) {
		throw new Error(
			`${fieldName}.manifestGeneratedAt must be a number or null`,
		);
	}
	if (!isFiniteNumber(value.manifestSpecCount) || value.manifestSpecCount < 0) {
		throw new Error(
			`${fieldName}.manifestSpecCount must be a non-negative number`,
		);
	}
	assertStringArray(value.excludedSpecIds, `${fieldName}.excludedSpecIds`);
	assertStringArray(value.specIds, `${fieldName}.specIds`);
	if (!isRecord(value.strata)) {
		throw new Error(`${fieldName}.strata must be an object`);
	}
	for (const [key, count] of Object.entries(value.strata)) {
		assertString(key, `${fieldName}.strata key`);
		if (!isFiniteNumber(count) || count < 0) {
			throw new Error(
				`${fieldName}.strata.${key} must be a non-negative number`,
			);
		}
	}
}

export function writeAutoHoldoutArtifact(
	artifact: AutoHoldoutArtifact,
	holdoutPath: string = resolveAutoWorkspacePaths().holdoutPath,
): void {
	assertValidAutoHoldoutArtifact(artifact);
	fs.mkdirSync(path.dirname(holdoutPath), { recursive: true });
	fs.writeFileSync(holdoutPath, JSON.stringify(artifact, null, 2), "utf8");
}

export function readAutoHoldoutArtifact(
	holdoutPath: string = resolveAutoWorkspacePaths().holdoutPath,
): AutoHoldoutArtifact | null {
	if (!fs.existsSync(holdoutPath)) {
		return null;
	}
	const parsed = JSON.parse(fs.readFileSync(holdoutPath, "utf8")) as unknown;
	assertValidAutoHoldoutArtifact(parsed);
	return parsed;
}

export function loadOrCreateAutoHoldout(
	manifest: EvaluationManifest,
	config: AutoHoldoutConfig,
	holdoutPath: string = resolveAutoWorkspacePaths().holdoutPath,
): AutoHoldoutArtifact {
	const existing = readAutoHoldoutArtifact(holdoutPath);
	if (existing) {
		return existing;
	}
	const created = createAutoHoldoutArtifact(manifest, config);
	writeAutoHoldoutArtifact(created, holdoutPath);
	return created;
}
