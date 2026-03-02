/**
 * Evaluation Service Layer
 * Handles business logic for evaluation operations
 */

import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	evaluationRuns,
	evaluations,
	testCases,
	testResults,
} from "@/db/schema";
import { CacheTTL, cachedHotPath, invalidateTag } from "@/lib/cache";
import { runAssertions } from "@/lib/eval/assertion-runners";
import { validateAssertionsEnvelope } from "@/lib/eval/assertions";
import { logger } from "@/lib/logger";
import { computeAndStoreQualityScore } from "@/lib/services/aggregate-metrics.service";
import type {
	CreateEvaluationBodyInput,
	PutEvaluationBodyInput,
} from "@/lib/validation";
import {
	createExecutor,
	type ExecutorConfig,
	type ExecutorType,
} from "./eval-executor";

export type CreateEvaluationInput = CreateEvaluationBodyInput;
export type UpdateEvaluationInput = PutEvaluationBodyInput;

export class EvaluationService {
	/**
	 * List evaluations for an organization with pagination
	 */
	async list(
		organizationId: number,
		options?: {
			limit?: number;
			offset?: number;
			status?: "draft" | "active" | "archived";
		},
	) {
		const limit = options?.limit || 50;
		const offset = options?.offset || 0;

		logger.info("Listing evaluations", {
			organizationId,
			limit,
			offset,
			status: options?.status,
		});

		const cacheKey = `list:${limit}:${offset}:${options?.status || "all"}`;
		return cachedHotPath(
			cacheKey,
			async () => {
				const whereConditions = [
					eq(evaluations.organizationId, organizationId),
				];

				if (options?.status) {
					whereConditions.push(eq(evaluations.status, options.status));
				}

				const results = await db
					.select()
					.from(evaluations)
					.where(and(...whereConditions))
					.limit(limit)
					.offset(offset)
					.orderBy(desc(evaluations.createdAt));

				logger.info("Evaluations listed", {
					count: results.length,
					organizationId,
				});

				return results;
			},
			{ ttlSeconds: CacheTTL.SHORT, organizationId, resource: "evaluations" },
		);
	}

	/**
	 * Get evaluation by ID
	 */
	async getById(id: number, organizationId: number) {
		logger.info("Getting evaluation by ID", { id, organizationId });

		return cachedHotPath(
			`byId:${id}`,
			async () => {
				const [evaluation] = await db
					.select()
					.from(evaluations)
					.where(
						and(
							eq(evaluations.id, id),
							eq(evaluations.organizationId, organizationId),
						),
					)
					.limit(1);

				if (!evaluation) {
					logger.warn("Evaluation not found", { id, organizationId });
					return null;
				}

				const evalTestCases = await db
					.select()
					.from(testCases)
					.where(eq(testCases.evaluationId, id))
					.limit(100);

				const evalRuns = await db
					.select()
					.from(evaluationRuns)
					.where(eq(evaluationRuns.evaluationId, id))
					.orderBy(desc(evaluationRuns.createdAt))
					.limit(10);

				logger.info("Evaluation retrieved", { id, organizationId });
				return { ...evaluation, testCases: evalTestCases, runs: evalRuns };
			},
			{ ttlSeconds: CacheTTL.SHORT, organizationId, resource: "evaluations" },
		);
	}

	/**
	 * Create a new evaluation
	 */
	async create(
		organizationId: number,
		createdBy: string,
		data: CreateEvaluationInput,
	) {
		logger.info("Creating evaluation", { organizationId, name: data.name });

		const [evaluation] = await db
			.insert(evaluations)
			.values({
				organizationId,
				createdBy,
				name: data.name,
				description: data.description || "",
				type: data.type || "standard",
				executionSettings:
					(data.executionSettings as import("@/db/types").ExecutionSettings) ??
					null,
				modelSettings:
					(data.modelSettings as import("@/db/types").ModelSettings) ?? null,
				customMetrics:
					(data.customMetrics as import("@/db/types").CustomMetrics) ?? null,
				status: "draft",
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		// Create test cases if provided
		if (data.testCases && data.testCases.length > 0) {
			await db.insert(testCases).values(
				data.testCases.map((tc, idx) => ({
					evaluationId: evaluation.id,
					name: tc.name || `Test Case ${idx + 1}`,
					input:
						typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
					expectedOutput:
						typeof tc.expectedOutput === "string"
							? tc.expectedOutput
							: tc.expectedOutput != null
								? JSON.stringify(tc.expectedOutput)
								: "",
					metadata:
						(tc.metadata as import("@/db/types").TestCaseMetadata) || null,
					createdAt: new Date(),
				})),
			);
		}

		logger.info("Evaluation created", { id: evaluation.id, organizationId });
		await invalidateTag("evaluations", organizationId);

		return evaluation;
	}

	/**
	 * Update an evaluation
	 */
	async update(
		id: number,
		organizationId: number,
		data: UpdateEvaluationInput,
	) {
		logger.info("Updating evaluation", { id, organizationId });

		// Verify ownership
		const existing = await this.getById(id, organizationId);
		if (!existing) {
			logger.warn("Evaluation not found for update", { id, organizationId });
			return null;
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (data.name !== undefined) updates.name = data.name;
		if (data.description !== undefined) updates.description = data.description;
		if (data.status !== undefined) updates.status = data.status;

		const [updated] = await db
			.update(evaluations)
			.set(updates)
			.where(
				and(
					eq(evaluations.id, id),
					eq(evaluations.organizationId, organizationId),
				),
			)
			.returning();

		logger.info("Evaluation updated", { id, organizationId });
		await invalidateTag("evaluations", organizationId);

		return updated;
	}

	/**
	 * Delete an evaluation
	 */
	async delete(id: number, organizationId: number) {
		logger.info("Deleting evaluation", { id, organizationId });

		// Verify ownership
		const existing = await this.getById(id, organizationId);
		if (!existing) {
			logger.warn("Evaluation not found for deletion", { id, organizationId });
			return false;
		}

		await db
			.delete(evaluations)
			.where(
				and(
					eq(evaluations.id, id),
					eq(evaluations.organizationId, organizationId),
				),
			);

		logger.info("Evaluation deleted", { id, organizationId });
		await invalidateTag("evaluations", organizationId);

		return true;
	}

	/**
	 * Run an evaluation — fetches test cases, executes them, writes results, computes metrics
	 */
	async run(
		id: number,
		organizationId: number,
		options?: { environment?: "dev" | "staging" | "prod" },
	) {
		logger.info("Running evaluation", { id, organizationId });

		const evaluation = await this.getById(id, organizationId);
		if (!evaluation) {
			logger.warn("Evaluation not found for run", { id, organizationId });
			return null;
		}

		// Fetch test cases from the canonical testCases table
		const cases = await db
			.select()
			.from(testCases)
			.where(eq(testCases.evaluationId, id));

		const env = options?.environment ?? "dev";
		const [run] = await db
			.insert(evaluationRuns)
			.values({
				evaluationId: id,
				organizationId,
				status: "running",
				startedAt: new Date(),
				totalCases: cases.length,
				passedCases: 0,
				failedCases: 0,
				environment: env,
				createdAt: new Date(),
			})
			.returning();

		logger.info("Evaluation run started", {
			runId: run.id,
			evaluationId: id,
			totalCases: cases.length,
		});

		if (cases.length === 0) {
			// No test cases — mark as completed with zero counts
			const completedAt = new Date();
			await db
				.update(evaluationRuns)
				.set({ status: "completed", completedAt })
				.where(eq(evaluationRuns.id, run.id));
			return { ...run, status: "completed" as const, completedAt };
		}

		// For human_eval type, create annotation tasks and wait — don't auto-complete
		if (evaluation.type === "human_eval") {
			await db
				.update(evaluationRuns)
				.set({ status: "pending_review" })
				.where(eq(evaluationRuns.id, run.id));
			logger.info("Human evaluation run awaiting review", { runId: run.id });
			return run;
		}

		// Execute test cases
		let passedCount = 0;
		let failedCount = 0;

		for (const tc of cases) {
			const startTime = Date.now();
			let status: "passed" | "failed" = "failed";
			let output: string | null = null;
			let score: number | null = null;
			let error: string | null = null;
			let traceLinkedMatched: boolean | null = null;
			let hasProvenance: boolean | null = null;

			try {
				if (evaluation.type === "unit_test" || evaluation.type === "standard") {
					// If an executor is configured, use it to generate real output
					const execType = evaluation.executorType as ExecutorType | null;
					const execConfig = (
						typeof evaluation.executorConfig === "string"
							? JSON.parse(evaluation.executorConfig)
							: evaluation.executorConfig
					) as ExecutorConfig | null;

					if (execType && execConfig) {
						const runContext = run.startedAt
							? {
									evaluationRunId: run.id,
									runStartedAt:
										run.startedAt instanceof Date
											? run.startedAt.toISOString()
											: (run.startedAt ?? undefined),
								}
							: undefined;
						const executor = createExecutor(
							execType,
							execConfig,
							organizationId,
							runContext,
						);
						const execResult = await executor.run(tc.input, {
							metadata: { evaluationRunId: run.id, testCaseId: tc.id },
						});
						output = execResult.output ?? "";
						traceLinkedMatched =
							execType === "trace_linked" && execResult.meta?.matched != null
								? execResult.meta.matched
								: null;
						hasProvenance =
							execType === "trace_linked" &&
							execResult.meta?.hasProvenance === true
								? true
								: null;

						// Compare executor output against expected
						if (tc.expectedOutput && tc.expectedOutput.trim().length > 0) {
							const expected = tc.expectedOutput.trim().toLowerCase();
							const actual = output.trim().toLowerCase();

							const expectedWords = expected
								.split(/\s+/)
								.filter((w) => w.length > 3);
							const matchedWords = expectedWords.filter((w) =>
								actual.includes(w),
							);
							const keywordMatchRate =
								expectedWords.length > 0
									? (matchedWords.length / expectedWords.length) * 100
									: 100;

							const isExactMatch = actual === expected;
							score = isExactMatch ? 100 : Math.round(keywordMatchRate);
							status = score >= 70 ? "passed" : "failed";
						} else {
							// No expected output — mark as passed with the actual output
							status = "passed";
							score = 100;
						}
					} else {
						// Heuristic fallback (no executor configured)
						logger.warn("No executor configured — using heuristic scoring", {
							evaluationId: id,
						});
						if (tc.expectedOutput && tc.expectedOutput.trim().length > 0) {
							output = tc.input;
							const expected = tc.expectedOutput.trim().toLowerCase();
							const actual = (tc.input || "").trim().toLowerCase();

							const expectedWords = expected
								.split(/\s+/)
								.filter((w) => w.length > 3);
							const matchedWords = expectedWords.filter((w) =>
								actual.includes(w),
							);
							const keywordMatchRate =
								expectedWords.length > 0
									? (matchedWords.length / expectedWords.length) * 100
									: 100;

							const lengthRatio =
								actual.length > 0 && expected.length > 0
									? Math.min(actual.length, expected.length) /
										Math.max(actual.length, expected.length)
									: 0;

							const isExactMatch = actual === expected;
							score = isExactMatch
								? 100
								: Math.round(keywordMatchRate * 0.7 + lengthRatio * 100 * 0.3);
							status = score >= 70 ? "passed" : "failed";
							output = tc.expectedOutput;
						} else {
							output = "No expected output defined — skipped assertion";
							status = "passed";
							score = 100;
						}
					}
				} else if (evaluation.type === "model_eval") {
					// Model evaluation: use LLM judge
					try {
						const { llmJudgeService } = await import(
							"@/lib/services/llm-judge.service"
						);

						// Find a judge config for this organization
						const configs = await llmJudgeService.listConfigs(organizationId, {
							limit: 1,
						});
						if (configs.length > 0) {
							const judgement = await llmJudgeService.evaluate(organizationId, {
								configId: configs[0].id,
								input: tc.input,
								output: tc.expectedOutput || "",
								metadata: { evaluationRunId: run.id, testCaseId: tc.id },
							});
							score = judgement.score;
							output = judgement.reasoning;
							status = judgement.passed ? "passed" : "failed";
						} else {
							// No judge config — skip with a note
							output = "No LLM judge config found for this organization";
							status = "failed";
							score = 0;
						}
					} catch (judgeError) {
						error =
							judgeError instanceof Error
								? judgeError.message
								: "LLM judge error";
						status = "failed";
						score = 0;
					}
				} else if (evaluation.type === "ab_test") {
					// A/B test: mark as passed (comparison happens externally)
					output = tc.expectedOutput || "";
					status = "passed";
					score = 100;
				}
			} catch (execError) {
				error =
					execError instanceof Error ? execError.message : "Execution error";
				status = "failed";
				score = 0;
			}

			const durationMs = Date.now() - startTime;

			// Run safety assertions when we have output (pii, toxicity)
			let assertionsJson: Record<string, unknown> | null = null;
			if (
				output &&
				(evaluation.type === "unit_test" || evaluation.type === "standard")
			) {
				const envelope = runAssertions(output, ["pii", "toxicity"]);
				assertionsJson = validateAssertionsEnvelope(
					envelope,
				) as unknown as Record<string, unknown>;
			}

			if (status === "passed") passedCount++;
			else failedCount++;

			// Insert test result
			await db.insert(testResults).values({
				evaluationRunId: run.id,
				testCaseId: tc.id,
				organizationId,
				status,
				output,
				score,
				error,
				traceLinkedMatched: traceLinkedMatched ?? null,
				...(hasProvenance != null && { hasProvenance }),
				assertionsJson:
					(assertionsJson as import("@/db/types").AssertionsJson) ?? undefined,
				durationMs,
				createdAt: new Date(),
			});
		}

		// Update run with final metrics
		await db
			.update(evaluationRuns)
			.set({
				status: "completed",
				totalCases: cases.length,
				passedCases: passedCount,
				failedCases: failedCount,
				completedAt: new Date(),
			})
			.where(eq(evaluationRuns.id, run.id));

		logger.info("Evaluation run completed", {
			runId: run.id,
			evaluationId: id,
			totalCases: cases.length,
			passedCases: passedCount,
			failedCases: failedCount,
		});

		// Compute quality score (fire-and-forget)
		computeAndStoreQualityScore(run.id, id, organizationId).catch((err) => {
			logger.error("Quality score computation failed", {
				runId: run.id,
				error: err instanceof Error ? err.message : String(err),
			});
		});

		return {
			...run,
			status: "completed" as const,
			totalCases: cases.length,
			passedCases: passedCount,
			failedCases: failedCount,
		};
	}

	/**
	 * Get evaluation statistics
	 */
	async getStats(id: number, organizationId: number) {
		logger.info("Getting evaluation stats", { id, organizationId });

		const evaluation = await this.getById(id, organizationId);
		if (!evaluation) {
			return null;
		}

		const [{ totalRuns }] = await db
			.select({ totalRuns: count() })
			.from(evaluationRuns)
			.where(eq(evaluationRuns.evaluationId, id));

		const [{ totalTestCases }] = await db
			.select({ totalTestCases: count() })
			.from(testCases)
			.where(eq(testCases.evaluationId, id));

		const [latestRun] = await db
			.select({ createdAt: evaluationRuns.createdAt })
			.from(evaluationRuns)
			.where(eq(evaluationRuns.evaluationId, id))
			.orderBy(desc(evaluationRuns.createdAt))
			.limit(1);

		return {
			totalRuns,
			totalTestCases,
			lastRunAt: latestRun?.createdAt || null,
			status: evaluation.status,
		};
	}
}

// Export singleton instance
export const evaluationService = new EvaluationService();
