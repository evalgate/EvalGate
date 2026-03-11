import * as fs from "node:fs";
import * as path from "node:path";

import { type FamilyPrior, rankMutationFamilies } from "./auto-families";
import { type AutoLedgerEntry, resolveAutoWorkspacePaths } from "./auto-ledger";

export const AUTO_CLUSTER_SCHEMA_VERSION = "1";
const DEFAULT_DOMINANT_PATTERN_LIMIT = 5;

export interface ClusterMemoryBestIntervention {
	experimentId: string;
	mutationFamily: string;
	utilityScore: number;
	objectiveReduction: number;
}

export interface ClusterMemoryFailedIntervention {
	experimentId: string;
	mutationFamily: string;
	reason: "vetoed" | "discarded";
	hardVetoReason: string | null;
}

export interface ClusterMemory {
	schemaVersion: "1";
	clusterId: string;
	targetFailureMode: string;
	firstSeenAt: string;
	lastUpdatedAt: string;
	traceCount: number;
	dominantPatterns: string[];
	bestIntervention: ClusterMemoryBestIntervention | null;
	failedInterventions: ClusterMemoryFailedIntervention[];
	suggestedNextFamily: string | null;
	resolvedAt: string | null;
}

export interface UpdateClusterMemoryInput {
	entry: AutoLedgerEntry;
	allowedFamilies: string[];
	familyPriors: FamilyPrior[];
	projectRoot?: string;
	clusterId?: string;
	observedPatterns?: string[];
	resolvedThreshold?: number | null;
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
	allowEmpty = false,
): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a string`);
	}
	if (!allowEmpty && value.trim().length === 0) {
		throw new Error(`${fieldName} must be a non-empty string`);
	}
}

function assertNullableString(
	value: unknown,
	fieldName: string,
): asserts value is string | null {
	if (value !== null && typeof value !== "string") {
		throw new Error(`${fieldName} must be a string or null`);
	}
	if (typeof value === "string" && value.trim().length === 0) {
		throw new Error(`${fieldName} must not be an empty string`);
	}
}

function assertStringArray(
	value: unknown,
	fieldName: string,
): asserts value is string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be an array of strings`);
	}
	for (const item of value) {
		assertString(item, fieldName);
	}
}

function assertNumber(
	value: unknown,
	fieldName: string,
): asserts value is number {
	if (!isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number`);
	}
}

function assertNullableObject(
	value: unknown,
	fieldName: string,
): asserts value is Record<string, unknown> | null {
	if (value !== null && !isRecord(value)) {
		throw new Error(`${fieldName} must be an object or null`);
	}
}

function ensureDirectoryForFile(filePath: string): void {
	const directory = path.dirname(filePath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
}

function isIsoTimestamp(value: string): boolean {
	return !Number.isNaN(Date.parse(value));
}

function normalizePatterns(patterns: string[]): string[] {
	const deduped = new Set<string>();
	for (const pattern of patterns) {
		const trimmed = pattern.trim();
		if (trimmed.length > 0) {
			deduped.add(trimmed);
		}
		if (deduped.size >= DEFAULT_DOMINANT_PATTERN_LIMIT) {
			break;
		}
	}
	return [...deduped];
}

function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "cluster"
	);
}

function makeDefaultClusterMemory(
	clusterId: string,
	entry: AutoLedgerEntry,
): ClusterMemory {
	return {
		schemaVersion: AUTO_CLUSTER_SCHEMA_VERSION,
		clusterId,
		targetFailureMode: entry.targetFailureMode,
		firstSeenAt: entry.timestamp,
		lastUpdatedAt: entry.timestamp,
		traceCount: 0,
		dominantPatterns: [],
		bestIntervention: null,
		failedInterventions: [],
		suggestedNextFamily: null,
		resolvedAt: null,
	};
}

function computeSuggestedNextFamily(
	allowedFamilies: string[],
	familyPriors: FamilyPrior[],
	failedInterventions: ClusterMemoryFailedIntervention[],
): string | null {
	const failedFamilies = new Set(
		failedInterventions.map((item) => item.mutationFamily),
	);
	const remainingFamilies = rankMutationFamilies(
		allowedFamilies.filter((family) => !failedFamilies.has(family)),
		familyPriors,
	);
	if (remainingFamilies.length > 0) {
		return remainingFamilies[0] ?? null;
	}
	return null;
}

export function buildAutoClusterId(targetFailureMode: string): string {
	assertString(targetFailureMode, "targetFailureMode");
	return `cluster-${slugify(targetFailureMode)}`;
}

export function resolveAutoClusterPath(
	clusterId: string,
	projectRoot: string = process.cwd(),
): string {
	assertString(clusterId, "clusterId");
	return path.join(
		resolveAutoWorkspacePaths(projectRoot).autoDir,
		"clusters",
		`${clusterId}.json`,
	);
}

export function resolveAutoClusterRelativePath(
	clusterId: string,
	projectRoot: string = process.cwd(),
): string {
	return path.relative(
		projectRoot,
		resolveAutoClusterPath(clusterId, projectRoot),
	);
}

export function assertValidClusterMemory(
	value: unknown,
	fieldName = "cluster",
): asserts value is ClusterMemory {
	if (!isRecord(value)) {
		throw new Error(`${fieldName} must be an object`);
	}
	assertString(value.schemaVersion, `${fieldName}.schemaVersion`);
	if (value.schemaVersion !== AUTO_CLUSTER_SCHEMA_VERSION) {
		throw new Error(
			`${fieldName}.schemaVersion must equal ${AUTO_CLUSTER_SCHEMA_VERSION}`,
		);
	}
	assertString(value.clusterId, `${fieldName}.clusterId`);
	assertString(value.targetFailureMode, `${fieldName}.targetFailureMode`);
	assertString(value.firstSeenAt, `${fieldName}.firstSeenAt`);
	if (!isIsoTimestamp(value.firstSeenAt)) {
		throw new Error(`${fieldName}.firstSeenAt must be a valid ISO timestamp`);
	}
	assertString(value.lastUpdatedAt, `${fieldName}.lastUpdatedAt`);
	if (!isIsoTimestamp(value.lastUpdatedAt)) {
		throw new Error(`${fieldName}.lastUpdatedAt must be a valid ISO timestamp`);
	}
	assertNumber(value.traceCount, `${fieldName}.traceCount`);
	assertStringArray(value.dominantPatterns, `${fieldName}.dominantPatterns`);
	assertNullableObject(value.bestIntervention, `${fieldName}.bestIntervention`);
	if (value.bestIntervention) {
		assertString(
			value.bestIntervention.experimentId,
			`${fieldName}.bestIntervention.experimentId`,
		);
		assertString(
			value.bestIntervention.mutationFamily,
			`${fieldName}.bestIntervention.mutationFamily`,
		);
		assertNumber(
			value.bestIntervention.utilityScore,
			`${fieldName}.bestIntervention.utilityScore`,
		);
		assertNumber(
			value.bestIntervention.objectiveReduction,
			`${fieldName}.bestIntervention.objectiveReduction`,
		);
	}
	if (!Array.isArray(value.failedInterventions)) {
		throw new Error(`${fieldName}.failedInterventions must be an array`);
	}
	for (const [index, item] of value.failedInterventions.entries()) {
		if (!isRecord(item)) {
			throw new Error(
				`${fieldName}.failedInterventions[${index}] must be an object`,
			);
		}
		assertString(
			item.experimentId,
			`${fieldName}.failedInterventions[${index}].experimentId`,
		);
		assertString(
			item.mutationFamily,
			`${fieldName}.failedInterventions[${index}].mutationFamily`,
		);
		if (item.reason !== "vetoed" && item.reason !== "discarded") {
			throw new Error(
				`${fieldName}.failedInterventions[${index}].reason must be vetoed or discarded`,
			);
		}
		assertNullableString(
			item.hardVetoReason,
			`${fieldName}.failedInterventions[${index}].hardVetoReason`,
		);
	}
	assertNullableString(
		value.suggestedNextFamily,
		`${fieldName}.suggestedNextFamily`,
	);
	assertNullableString(value.resolvedAt, `${fieldName}.resolvedAt`);
	if (value.resolvedAt !== null && !isIsoTimestamp(value.resolvedAt)) {
		throw new Error(`${fieldName}.resolvedAt must be a valid ISO timestamp`);
	}
}

export function writeClusterMemory(
	cluster: ClusterMemory,
	clusterPath: string = resolveAutoClusterPath(cluster.clusterId),
): void {
	assertValidClusterMemory(cluster);
	ensureDirectoryForFile(clusterPath);
	fs.writeFileSync(clusterPath, JSON.stringify(cluster, null, 2), "utf8");
}

export function readClusterMemory(clusterPath: string): ClusterMemory {
	const parsed = JSON.parse(fs.readFileSync(clusterPath, "utf8")) as unknown;
	assertValidClusterMemory(parsed);
	return parsed;
}

export function readClusterMemoryById(
	clusterId: string,
	projectRoot: string = process.cwd(),
): ClusterMemory | null {
	const clusterPath = resolveAutoClusterPath(clusterId, projectRoot);
	if (!fs.existsSync(clusterPath)) {
		return null;
	}
	return readClusterMemory(clusterPath);
}

export function updateClusterMemoryForIteration(
	input: UpdateClusterMemoryInput,
): ClusterMemory {
	assertStringArray(input.allowedFamilies, "allowedFamilies");
	const clusterId =
		input.clusterId ?? buildAutoClusterId(input.entry.targetFailureMode);
	const existing = readClusterMemoryById(clusterId, input.projectRoot);
	const cluster = existing ?? makeDefaultClusterMemory(clusterId, input.entry);
	const timestamp = input.entry.timestamp;
	cluster.traceCount += 1;
	cluster.lastUpdatedAt = timestamp;
	cluster.dominantPatterns = normalizePatterns([
		...(input.observedPatterns ?? []),
		...cluster.dominantPatterns,
	]);
	if (input.entry.decision === "keep") {
		const candidateUtility = input.entry.utilityScore ?? 0;
		if (
			cluster.bestIntervention === null ||
			candidateUtility > cluster.bestIntervention.utilityScore
		) {
			cluster.bestIntervention = {
				experimentId: input.entry.experimentId,
				mutationFamily: input.entry.mutationFamily,
				utilityScore: candidateUtility,
				objectiveReduction: input.entry.objectiveReductionRatio,
			};
		}
	}
	if (input.entry.decision === "discard" || input.entry.decision === "vetoed") {
		const reason = input.entry.decision === "vetoed" ? "vetoed" : "discarded";
		const alreadyRecorded = cluster.failedInterventions.some(
			(item) => item.experimentId === input.entry.experimentId,
		);
		if (!alreadyRecorded) {
			cluster.failedInterventions.push({
				experimentId: input.entry.experimentId,
				mutationFamily: input.entry.mutationFamily,
				reason,
				hardVetoReason: input.entry.hardVetoReason,
			});
		}
	}
	if (
		typeof input.resolvedThreshold === "number" &&
		Number.isFinite(input.resolvedThreshold) &&
		input.entry.candidateObjectiveRate <= input.resolvedThreshold
	) {
		cluster.resolvedAt = cluster.resolvedAt ?? timestamp;
	}
	cluster.suggestedNextFamily = computeSuggestedNextFamily(
		input.allowedFamilies,
		input.familyPriors.filter(
			(prior) => prior.failureMode === input.entry.targetFailureMode,
		),
		cluster.failedInterventions,
	);
	writeClusterMemory(
		cluster,
		resolveAutoClusterPath(clusterId, input.projectRoot),
	);
	return cluster;
}
