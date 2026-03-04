/**
 * DB integration tests for Production → CI Loop tables:
 * failure_reports, candidate_eval_cases, user_feedback
 *
 * Uses PGlite via tests/setup.db.ts — all tables created from migration SQL.
 * Must run in the DB lane (`pnpm test:db`). Skips automatically otherwise.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import {
	candidateEvalCases,
	evaluationRuns,
	evaluations,
	failureReports,
	organizations,
	traces,
	user,
	userFeedback,
} from "@/db/schema";

const isDbLane = process.env.DATABASE_URL?.startsWith("pglite://");

// ── Helpers ────────────────────────────────────────────────────────────────

let db: Database;
let orgId: number;
let traceDbId: number;
let evalId: number;
let evalRunId: number;

describe.runIf(isDbLane)("production-ci-tables", () => {
	beforeAll(async () => {
		// Dynamic import so @/db only loads in the DB lane (avoids real PG connection)
		const mod = await import("@/db");
		db = mod.db;

		// Seed org — reuse existing if present
		const [existingOrg] = await db.select().from(organizations).limit(1);
		orgId = existingOrg!.id;

		// Seed a trace for FK references
		const [t] = await db
			.insert(traces)
			.values({
				name: "prod-ci-test-trace",
				traceId: `pci-trace-${Date.now()}`,
				organizationId: orgId,
				status: "success",
				createdAt: new Date(),
			})
			.returning();
		traceDbId = t!.id;

		// Seed an evaluation for FK references
		const [e] = await db
			.insert(evaluations)
			.values({
				name: "Test Eval",
				type: "manual",
				organizationId: orgId,
				createdBy: "test-user",
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();
		evalId = e!.id;

		// Seed an evaluation run
		const [er] = await db
			.insert(evaluationRuns)
			.values({
				evaluationId: evalId,
				organizationId: orgId,
				status: "completed",
				createdAt: new Date(),
			})
			.returning();
		evalRunId = er!.id;
	});

	// ── failure_reports ────────────────────────────────────────────────────────

	describe("failure_reports table", () => {
		it("inserts a failure report with required fields", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					category: "hallucination",
					severity: "high",
					description: "Model fabricated meeting action items",
					confidence: 85,
					detectedBy: "rule-based",
					createdAt: new Date(),
				})
				.returning();

			expect(row).toBeDefined();
			expect(row!.category).toBe("hallucination");
			expect(row!.severity).toBe("high");
			expect(row!.confidence).toBe(85);
			expect(row!.status).toBe("open"); // default
			expect(row!.detectorCount).toBe(1); // default
			expect(row!.occurrenceCount).toBe(1); // default
		});

		it("stores group_hash for failure grouping", async () => {
			const groupHash = "abc123hash";
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					category: "refusal",
					severity: "medium",
					description: "Refused valid request",
					confidence: 72,
					detectedBy: "rule-based",
					groupHash,
					createdAt: new Date(),
				})
				.returning();

			expect(row!.groupHash).toBe(groupHash);

			// Query by group_hash (uses idx_failure_reports_group)
			const grouped = await db
				.select()
				.from(failureReports)
				.where(
					and(
						eq(failureReports.organizationId, orgId),
						eq(failureReports.groupHash, groupHash),
					),
				);
			expect(grouped.length).toBeGreaterThanOrEqual(1);
		});

		it("stores model_version, prompt_version, detector_count", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					category: "compliance_violation",
					severity: "critical",
					description: "PII leak detected",
					confidence: 95,
					detectorCount: 3,
					detectedBy: "rule-based",
					modelVersion: "gpt-4o-2024-08",
					promptVersion: "v2.3.1-hash-abc",
					createdAt: new Date(),
				})
				.returning();

			expect(row!.detectorCount).toBe(3);
			expect(row!.modelVersion).toBe("gpt-4o-2024-08");
			expect(row!.promptVersion).toBe("v2.3.1-hash-abc");
		});

		it("stores JSONB fields: secondaryCategories, suggestedFixes, lineage", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					category: "hallucination",
					severity: "high",
					description: "Fabricated facts with formatting issues",
					confidence: 80,
					detectedBy: "rule-based",
					secondaryCategories: ["formatting", "incomplete"],
					suggestedFixes: [
						{
							type: "prompt_edit",
							description: "Add grounding context",
							confidence: 0.7,
						},
					],
					lineage: {
						causedByTraceIds: ["trace-1"],
						preventedRegressionIds: [],
						clusterId: null,
						derivedTestCaseIds: [],
					},
					createdAt: new Date(),
				})
				.returning();

			expect(row!.secondaryCategories).toEqual(["formatting", "incomplete"]);
			expect(row!.suggestedFixes).toHaveLength(1);
			expect(row!.lineage!.causedByTraceIds).toEqual(["trace-1"]);
		});

		it("supports status transitions", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					category: "off_topic",
					severity: "medium",
					description: "Off topic response",
					confidence: 60,
					detectedBy: "rule-based",
					createdAt: new Date(),
				})
				.returning();

			// Transition: open → acknowledged
			await db
				.update(failureReports)
				.set({ status: "acknowledged" })
				.where(eq(failureReports.id, row!.id));

			const [updated] = await db
				.select()
				.from(failureReports)
				.where(eq(failureReports.id, row!.id));

			expect(updated!.status).toBe("acknowledged");
		});

		it("allows null traceId (FK with ON DELETE SET NULL)", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					traceId: null,
					category: "other",
					severity: "low",
					description: "Orphaned failure report",
					confidence: 50,
					detectedBy: "rule-based",
					createdAt: new Date(),
				})
				.returning();

			expect(row!.traceId).toBeNull();
		});

		it("references evaluation_run via FK", async () => {
			const [row] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					evaluationRunId: evalRunId,
					category: "reasoning_error",
					severity: "high",
					description: "Bad reasoning chain",
					confidence: 78,
					detectedBy: "rule-based",
					createdAt: new Date(),
				})
				.returning();

			expect(row!.evaluationRunId).toBe(evalRunId);
		});
	});

	// ── candidate_eval_cases ────────────────────────────────────────────────────

	describe("candidate_eval_cases table", () => {
		let failureReportId: number;

		beforeAll(async () => {
			const [fr] = await db
				.insert(failureReports)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					category: "hallucination",
					severity: "high",
					description: "For candidate tests",
					confidence: 90,
					detectorCount: 2,
					detectedBy: "rule-based",
					createdAt: new Date(),
				})
				.returning();
			failureReportId = fr!.id;
		});

		it("inserts a candidate with required fields", async () => {
			const [row] = await db
				.insert(candidateEvalCases)
				.values({
					organizationId: orgId,
					failureReportId,
					traceId: traceDbId,
					title: "[hallucination] Summarize meeting notes",
					evalCaseId: "ec_0000000000000001",
					createdAt: new Date(),
				})
				.returning();

			expect(row).toBeDefined();
			expect(row!.status).toBe("quarantined"); // default
			expect(row!.autoPromoteEligible).toBe(false); // default
			expect(row!.title).toBe("[hallucination] Summarize meeting notes");
		});

		it("stores JSONB fields: tags, sourceTraceIds, expectedConstraints, minimizedInput", async () => {
			const [row] = await db
				.insert(candidateEvalCases)
				.values({
					organizationId: orgId,
					title: "Test constraints storage",
					evalCaseId: `ec_jsonb_${Date.now()}`,
					tags: ["auto-generated", "hallucination", "severity:high"],
					sourceTraceIds: ["trace-1", "trace-2"],
					expectedConstraints: [
						{
							type: "no_toxicity",
							value: true,
							required: true,
							description: "No fabricated facts",
						},
					],
					minimizedInput: {
						userPrompt: "Summarize the Q3 meeting notes",
						systemPrompt: "You are a helpful assistant",
						activeTools: [],
						conversationContext: [],
						failureSpanId: "span-42",
						failureOutput: "Hallucinated 3 action items",
						metadata: { model: "gpt-4o" },
					},
					createdAt: new Date(),
				})
				.returning();

			expect(row!.tags).toEqual([
				"auto-generated",
				"hallucination",
				"severity:high",
			]);
			expect(row!.sourceTraceIds).toEqual(["trace-1", "trace-2"]);
			expect(row!.expectedConstraints).toHaveLength(1);
			expect(row!.minimizedInput!.userPrompt).toBe(
				"Summarize the Q3 meeting notes",
			);
			expect(row!.minimizedInput!.failureSpanId).toBe("span-42");
		});

		it("sets auto_promote_eligible when conditions met", async () => {
			// Simulate the heuristic: quality >= 90, confidence (on report) >= 80, detectorCount >= 2
			const [row] = await db
				.insert(candidateEvalCases)
				.values({
					organizationId: orgId,
					failureReportId,
					title: "Auto-promotable candidate",
					evalCaseId: `ec_auto_${Date.now()}`,
					qualityScore: 92,
					qualityVerdict: "high",
					autoPromoteEligible: true, // computed by pipeline
					createdAt: new Date(),
				})
				.returning();

			expect(row!.autoPromoteEligible).toBe(true);
			expect(row!.qualityScore).toBe(92);
		});

		it("supports status transitions: quarantined → approved → promoted", async () => {
			const [row] = await db
				.insert(candidateEvalCases)
				.values({
					organizationId: orgId,
					title: "Status transition test",
					evalCaseId: `ec_status_${Date.now()}`,
					createdAt: new Date(),
				})
				.returning();

			// quarantined → approved
			await db
				.update(candidateEvalCases)
				.set({
					status: "approved",
					reviewedBy: "test-user",
					reviewedAt: new Date(),
				})
				.where(eq(candidateEvalCases.id, row!.id));

			const [approved] = await db
				.select()
				.from(candidateEvalCases)
				.where(eq(candidateEvalCases.id, row!.id));
			expect(approved!.status).toBe("approved");
			expect(approved!.reviewedBy).toBe("test-user");
			expect(approved!.reviewedAt).toBeInstanceOf(Date);

			// approved → promoted (set evaluation FK)
			await db
				.update(candidateEvalCases)
				.set({ status: "promoted", promotedToEvaluationId: evalId })
				.where(eq(candidateEvalCases.id, row!.id));

			const [promoted] = await db
				.select()
				.from(candidateEvalCases)
				.where(eq(candidateEvalCases.id, row!.id));
			expect(promoted!.status).toBe("promoted");
			expect(promoted!.promotedToEvaluationId).toBe(evalId);
		});

		it("queries by org + status (uses idx_candidates_org_status)", async () => {
			const quarantined = await db
				.select()
				.from(candidateEvalCases)
				.where(
					and(
						eq(candidateEvalCases.organizationId, orgId),
						eq(candidateEvalCases.status, "quarantined"),
					),
				);

			expect(quarantined.length).toBeGreaterThanOrEqual(1);
			for (const c of quarantined) {
				expect(c.status).toBe("quarantined");
				expect(c.organizationId).toBe(orgId);
			}
		});

		it("queries by org + auto_promote_eligible (uses idx_candidates_org_auto_promote)", async () => {
			const eligible = await db
				.select()
				.from(candidateEvalCases)
				.where(
					and(
						eq(candidateEvalCases.organizationId, orgId),
						eq(candidateEvalCases.autoPromoteEligible, true),
					),
				);

			for (const c of eligible) {
				expect(c.autoPromoteEligible).toBe(true);
			}
		});
	});

	// ── user_feedback ───────────────────────────────────────────────────────────

	describe("user_feedback table", () => {
		it("inserts thumbs_down feedback", async () => {
			const [row] = await db
				.insert(userFeedback)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					feedbackType: "thumbs_down",
					value: { score: 0 },
					userIdExternal: "end-user-123",
					createdAt: new Date(),
				})
				.returning();

			expect(row).toBeDefined();
			expect(row!.feedbackType).toBe("thumbs_down");
			expect(row!.value).toEqual({ score: 0 });
			expect(row!.userIdExternal).toBe("end-user-123");
		});

		it("inserts thumbs_up feedback", async () => {
			const [row] = await db
				.insert(userFeedback)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					feedbackType: "thumbs_up",
					value: { score: 1 },
					createdAt: new Date(),
				})
				.returning();

			expect(row!.feedbackType).toBe("thumbs_up");
			expect(row!.userIdExternal).toBeNull();
		});

		it("inserts rating feedback with comment", async () => {
			const [row] = await db
				.insert(userFeedback)
				.values({
					organizationId: orgId,
					traceId: traceDbId,
					feedbackType: "rating",
					value: { score: 3, comment: "Partially helpful" },
					createdAt: new Date(),
				})
				.returning();

			expect(row!.value!.score).toBe(3);
			expect(row!.value!.comment).toBe("Partially helpful");
		});

		it("queries feedback by trace (uses idx_user_feedback_trace)", async () => {
			const feedback = await db
				.select()
				.from(userFeedback)
				.where(eq(userFeedback.traceId, traceDbId));

			expect(feedback.length).toBeGreaterThanOrEqual(3);
		});

		it("queries feedback by org + created_at (uses idx_user_feedback_org_created)", async () => {
			const feedback = await db
				.select()
				.from(userFeedback)
				.where(eq(userFeedback.organizationId, orgId));

			expect(feedback.length).toBeGreaterThanOrEqual(1);
			for (const f of feedback) {
				expect(f.organizationId).toBe(orgId);
			}
		});
	});
});
