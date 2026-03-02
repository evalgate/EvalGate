/**
 * Evaluation Versioning Service
 *
 * Handles snapshotting evaluation configs on publish,
 * computing diff summaries, and version history.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, evaluationVersions, testCases } from "@/db/schema";
import { logger } from "@/lib/logger";

/** JSON.stringify with sorted keys for deterministic output. */
function stableStringify(obj: unknown): string {
	return JSON.stringify(obj, (_key, value) => {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return Object.keys(value)
				.sort()
				.reduce<Record<string, unknown>>((sorted, k) => {
					sorted[k] = (value as Record<string, unknown>)[k];
					return sorted;
				}, {});
		}
		return value;
	});
}

export interface VersionSnapshot {
	evaluation: {
		name: string;
		description: string | null;
		type: string;
		status: string;
		executionSettings: unknown;
		modelSettings: unknown;
		customMetrics: unknown;
		executorType: string | null;
		executorConfig: unknown;
		policyPack?: string | null;
	};
	testCases: Array<{
		id: number;
		name: string;
		input: string;
		expectedOutput: string | null;
		metadata: unknown;
	}>;
	createdAt: string;
}

export class VersioningService {
	/**
	 * Create a new version snapshot for an evaluation.
	 */
	async createVersion(
		evaluationId: number,
		organizationId: number,
		createdBy: string,
	): Promise<{ version: number; diffSummary: string | null }> {
		logger.info("Creating evaluation version", {
			evaluationId,
			organizationId,
		});

		// Fetch the evaluation
		const [evaluation] = await db
			.select()
			.from(evaluations)
			.where(
				and(
					eq(evaluations.id, evaluationId),
					eq(evaluations.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!evaluation) {
			throw new Error("Evaluation not found");
		}

		// Fetch test cases from canonical table, sorted by id for deterministic snapshots
		const cases = await db
			.select()
			.from(testCases)
			.where(eq(testCases.evaluationId, evaluationId))
			.orderBy(asc(testCases.id));

		// Build deterministic snapshot (sorted keys, sorted test cases)
		const snapshot: VersionSnapshot = {
			evaluation: {
				name: evaluation.name,
				description: evaluation.description,
				type: evaluation.type,
				status: evaluation.status,
				executionSettings: evaluation.executionSettings,
				modelSettings: evaluation.modelSettings,
				customMetrics: evaluation.customMetrics,
				executorType: evaluation.executorType,
				executorConfig: evaluation.executorConfig,
				policyPack:
					(evaluation as { policyPack?: string | null }).policyPack ?? null,
			},
			testCases: cases.map((tc) => ({
				id: tc.id,
				name: tc.name,
				input: tc.input,
				expectedOutput: tc.expectedOutput,
				metadata: tc.metadata,
			})),
			createdAt: new Date().toISOString(),
		};

		// Determine new version number
		const [latestVersion] = await db
			.select()
			.from(evaluationVersions)
			.where(eq(evaluationVersions.evaluationId, evaluationId))
			.orderBy(desc(evaluationVersions.version))
			.limit(1);

		const newVersion = (latestVersion?.version ?? 0) + 1;

		// Compute diff summary
		let diffSummary: string | null = null;
		if (latestVersion) {
			diffSummary = this.computeDiffSummary(
				latestVersion.snapshotJson as unknown as VersionSnapshot,
				snapshot,
				latestVersion.version,
			);
		}

		// Store version
		await db.insert(evaluationVersions).values({
			evaluationId,
			version: newVersion,
			snapshotJson:
				snapshot as unknown as import("@/db/types").VersionSnapshotJson,
			diffSummary,
			createdBy,
			createdAt: new Date(),
		});

		// Update evaluation
		await db
			.update(evaluations)
			.set({
				publishedVersion: newVersion,
				status: "published",
				updatedAt: new Date(),
			})
			.where(eq(evaluations.id, evaluationId));

		logger.info("Evaluation version created", {
			evaluationId,
			version: newVersion,
		});

		return { version: newVersion, diffSummary };
	}

	/**
	 * List all versions for an evaluation.
	 */
	async listVersions(evaluationId: number, limit = 20, offset = 0) {
		return db
			.select()
			.from(evaluationVersions)
			.where(eq(evaluationVersions.evaluationId, evaluationId))
			.orderBy(desc(evaluationVersions.version))
			.limit(limit)
			.offset(offset);
	}

	/**
	 * Get a specific version.
	 */
	async getVersion(evaluationId: number, version: number) {
		const [v] = await db
			.select()
			.from(evaluationVersions)
			.where(
				and(
					eq(evaluationVersions.evaluationId, evaluationId),
					eq(evaluationVersions.version, version),
				),
			)
			.limit(1);
		return v ?? null;
	}

	/**
	 * Compute a human-readable diff summary between two snapshots.
	 */
	private computeDiffSummary(
		previous: VersionSnapshot,
		current: VersionSnapshot,
		previousVersion: number,
	): string {
		const parts: string[] = [];

		const prevCaseCount = previous.testCases?.length ?? 0;
		const currCaseCount = current.testCases?.length ?? 0;

		if (prevCaseCount !== currCaseCount) {
			const delta = currCaseCount - prevCaseCount;
			parts.push(
				`${delta > 0 ? "+" : ""}${delta} test cases (${prevCaseCount} -> ${currCaseCount})`,
			);
		}

		// Count changed cases (by ID match)
		const prevMap = new Map(previous.testCases?.map((tc) => [tc.id, tc]) ?? []);
		let changedCount = 0;
		for (const tc of current.testCases ?? []) {
			const prev = prevMap.get(tc.id);
			if (
				prev &&
				(prev.input !== tc.input || prev.expectedOutput !== tc.expectedOutput)
			) {
				changedCount++;
			}
		}

		if (changedCount > 0) {
			const pct = Math.round((changedCount / Math.max(currCaseCount, 1)) * 100);
			parts.push(`${pct}% of cases changed (${changedCount} modified)`);
		}

		if (previous.evaluation.type !== current.evaluation.type) {
			parts.push(
				`type changed: ${previous.evaluation.type} -> ${current.evaluation.type}`,
			);
		}

		if (previous.evaluation.executorType !== current.evaluation.executorType) {
			parts.push(
				`executor changed: ${previous.evaluation.executorType || "none"} -> ${current.evaluation.executorType || "none"}`,
			);
		}

		if (parts.length === 0) {
			return `No changes from v${previousVersion}`;
		}

		return `Changes from v${previousVersion}: ${parts.join("; ")}`;
	}
}

export const versioningService = new VersioningService();
