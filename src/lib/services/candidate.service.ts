/**
 * Candidate Eval Case Service
 * Business logic for candidate CRUD + promotion flow.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	candidateEvalCases,
	evaluations,
	failureReports,
	testCases,
} from "@/db/schema";
import { deduplicateAgainstExistingTests } from "@/lib/pipeline/dedup-existing-tests";

export interface ListCandidatesOpts {
	limit: number;
	offset: number;
	status?: string;
	autoPromoteEligible?: boolean;
}

export const candidateService = {
	async list(organizationId: number, opts: ListCandidatesOpts) {
		const conditions = [eq(candidateEvalCases.organizationId, organizationId)];

		if (opts.status) {
			conditions.push(eq(candidateEvalCases.status, opts.status));
		}
		if (opts.autoPromoteEligible !== undefined) {
			conditions.push(
				eq(candidateEvalCases.autoPromoteEligible, opts.autoPromoteEligible),
			);
		}

		return db
			.select()
			.from(candidateEvalCases)
			.where(and(...conditions))
			.orderBy(desc(candidateEvalCases.createdAt))
			.limit(opts.limit)
			.offset(opts.offset);
	},

	async getById(organizationId: number, candidateId: number) {
		const [row] = await db
			.select()
			.from(candidateEvalCases)
			.where(
				and(
					eq(candidateEvalCases.id, candidateId),
					eq(candidateEvalCases.organizationId, organizationId),
				),
			)
			.limit(1);
		return row ?? null;
	},

	async getWithFailureReport(organizationId: number, candidateId: number) {
		const candidate = await this.getById(organizationId, candidateId);
		if (!candidate) return null;

		let report = null;
		if (candidate.failureReportId) {
			const [fr] = await db
				.select()
				.from(failureReports)
				.where(eq(failureReports.id, candidate.failureReportId))
				.limit(1);
			report = fr ?? null;
		}

		return { candidate, failureReport: report };
	},

	async updateStatus(
		organizationId: number,
		candidateId: number,
		status: string,
		reviewedBy?: string,
	) {
		const candidate = await this.getById(organizationId, candidateId);
		if (!candidate) return { ok: false as const, reason: "not_found" };

		const updateData: Record<string, unknown> = { status };
		if (reviewedBy) {
			updateData.reviewedBy = reviewedBy;
			updateData.reviewedAt = new Date();
		}

		await db
			.update(candidateEvalCases)
			.set(updateData)
			.where(eq(candidateEvalCases.id, candidateId));

		return { ok: true as const };
	},

	/**
	 * Promote a candidate to a target evaluation's test suite.
	 * Creates a testCase row and updates the candidate status.
	 */
	async promote(
		organizationId: number,
		candidateId: number,
		targetEvaluationId: number,
		reviewedBy: string,
	) {
		const candidate = await this.getById(organizationId, candidateId);
		if (!candidate) return { ok: false as const, reason: "not_found" };

		if (candidate.status === "promoted") {
			return { ok: false as const, reason: "already_promoted" };
		}

		// Verify evaluation belongs to org
		const [eval_] = await db
			.select()
			.from(evaluations)
			.where(
				and(
					eq(evaluations.id, targetEvaluationId),
					eq(evaluations.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!eval_) return { ok: false as const, reason: "evaluation_not_found" };

		// Dedup check — prevent near-duplicates in the golden dataset
		const minimizedInput = candidate.minimizedInput as Record<
			string,
			unknown
		> | null;
		const userPrompt = minimizedInput?.userPrompt as string | null | undefined;
		const dedup = await deduplicateAgainstExistingTests({
			evaluationId: targetEvaluationId,
			userPrompt,
			title: candidate.title,
		});

		if (dedup.isDuplicate) {
			return {
				ok: false as const,
				reason: "duplicate_test_exists",
				matchedTestCaseId: dedup.matchedTestCaseId,
				matchType: dedup.matchType,
			};
		}

		// Create testCase from candidate
		const inputStr = candidate.minimizedInput
			? JSON.stringify(candidate.minimizedInput)
			: "";

		const [newTestCase] = await db
			.insert(testCases)
			.values({
				evaluationId: targetEvaluationId,
				name: candidate.title,
				input: inputStr,
				expectedOutput: candidate.expectedConstraints
					? JSON.stringify(candidate.expectedConstraints)
					: null,
				metadata: {
					source: "production_failure",
					candidateId: candidate.id,
					failureReportId: candidate.failureReportId,
					evalCaseId: candidate.evalCaseId,
					tags: candidate.tags ?? undefined,
				},
				createdAt: new Date(),
			})
			.returning();

		// Update candidate status
		await db
			.update(candidateEvalCases)
			.set({
				status: "promoted",
				promotedToEvaluationId: targetEvaluationId,
				reviewedBy,
				reviewedAt: new Date(),
			})
			.where(eq(candidateEvalCases.id, candidateId));

		return {
			ok: true as const,
			testCaseId: newTestCase?.id,
			evaluationId: targetEvaluationId,
		};
	},

	async countByStatus(organizationId: number) {
		const rows = await db
			.select({
				status: candidateEvalCases.status,
				count: sql<number>`count(*)::int`,
			})
			.from(candidateEvalCases)
			.where(eq(candidateEvalCases.organizationId, organizationId))
			.groupBy(candidateEvalCases.status);

		const counts: Record<string, number> = {};
		for (const r of rows) {
			counts[r.status] = r.count;
		}
		return counts;
	},
};
