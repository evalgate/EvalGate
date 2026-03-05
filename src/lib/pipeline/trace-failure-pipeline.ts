/**
 * Trace Failure Analysis Pipeline
 *
 * Orchestrates the full detection → grouping → generation → scoring → persist flow.
 * Called by the trace_failure_analysis job handler.
 *
 * Steps:
 *   1. Load trace + spans from DB
 *   2. Run rule-based failure detection on each output span
 *   3. Aggregate detector signals → confidence + category
 *   4. Compute group_hash for failure deduplication
 *   5. Generate candidate eval case from trace
 *   6. Score candidate quality
 *   7. Evaluate auto-promote eligibility
 *   8. Persist failure_report + candidate_eval_case
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateEvalCases, failureReports, spans, traces } from "@/db/schema";
import { aggregateDetectorSignals } from "@/lib/failures/confidence";
import { detectRuleBased } from "@/lib/failures/detectors/rule-based";
import { createFailureReport } from "@/lib/failures/taxonomy";
import { logger } from "@/lib/logger";
import { isAutoPromoteEligible } from "@/lib/pipeline/auto-promote";
import { computeGroupHash } from "@/lib/pipeline/group-hash";
import { generateFromTrace } from "@/lib/testgen/generator";
import { evaluateTestQuality } from "@/lib/testgen/test-quality-evaluator";

export interface PipelineInput {
	traceDbId: number;
	organizationId: number;
}

export interface PipelineResult {
	failureReportId: number | null;
	candidateId: number | null;
	category: string | null;
	autoPromoteEligible: boolean;
	skipped: boolean;
	skipReason?: string;
}

export async function runTraceFailurePipeline(
	input: PipelineInput,
): Promise<PipelineResult> {
	const { traceDbId, organizationId } = input;

	// ── Step 1: Load trace + spans ──────────────────────────────────────────
	const [trace] = await db
		.select()
		.from(traces)
		.where(
			and(eq(traces.id, traceDbId), eq(traces.organizationId, organizationId)),
		)
		.limit(1);

	if (!trace) {
		return {
			failureReportId: null,
			candidateId: null,
			category: null,
			autoPromoteEligible: false,
			skipped: true,
			skipReason: "trace_not_found",
		};
	}

	// Mark trace as analyzing
	await db
		.update(traces)
		.set({ analysisStatus: "analyzing" })
		.where(eq(traces.id, traceDbId));

	try {
		return await runPipelineCore(trace, traceDbId, organizationId);
	} catch (err) {
		// Mark trace as failed on unhandled error
		await db
			.update(traces)
			.set({ analysisStatus: "failed" })
			.where(eq(traces.id, traceDbId));
		throw err;
	}
}

async function runPipelineCore(
	trace: typeof traces.$inferSelect,
	traceDbId: number,
	organizationId: number,
): Promise<PipelineResult> {
	const traceSpans = await db
		.select()
		.from(spans)
		.where(eq(spans.traceId, traceDbId));

	if (traceSpans.length === 0) {
		return {
			failureReportId: null,
			candidateId: null,
			category: null,
			autoPromoteEligible: false,
			skipped: true,
			skipReason: "no_spans",
		};
	}

	// ── Step 2: Run rule-based detection on output spans ─────────────────────
	// Find span(s) with output — typically the final LLM response
	const outputSpans = traceSpans.filter((s) => s.output);
	if (outputSpans.length === 0) {
		return {
			failureReportId: null,
			candidateId: null,
			category: null,
			autoPromoteEligible: false,
			skipped: true,
			skipReason: "no_output_spans",
		};
	}

	// Detect on the last output span (typically the final response)
	const targetSpan = outputSpans[outputSpans.length - 1]!;
	const signals = detectRuleBased({
		output: targetSpan.output!,
		input: targetSpan.input ?? undefined,
	});

	if (signals.length === 0) {
		return {
			failureReportId: null,
			candidateId: null,
			category: null,
			autoPromoteEligible: false,
			skipped: true,
			skipReason: "no_failures_detected",
		};
	}

	// ── Step 3: Aggregate signals ──────────────────────────────────────────
	const aggregated = aggregateDetectorSignals(signals);
	if (!aggregated) {
		return {
			failureReportId: null,
			candidateId: null,
			category: null,
			autoPromoteEligible: false,
			skipped: true,
			skipReason: "aggregation_returned_null",
		};
	}

	// ── Step 4: Compute group_hash ─────────────────────────────────────────
	const userPrompt = targetSpan.input ?? null;
	const groupHash = computeGroupHash(aggregated.category, userPrompt);

	// Check for existing group — increment occurrence instead of creating duplicate
	if (groupHash) {
		const [existing] = await db
			.select()
			.from(failureReports)
			.where(
				and(
					eq(failureReports.organizationId, organizationId),
					eq(failureReports.groupHash, groupHash),
				),
			)
			.limit(1);

		if (existing) {
			// Increment occurrence count
			await db
				.update(failureReports)
				.set({
					occurrenceCount: existing.occurrenceCount + 1,
				})
				.where(eq(failureReports.id, existing.id));

			logger.info("Failure group incremented", {
				failureReportId: existing.id,
				groupHash,
				newCount: existing.occurrenceCount + 1,
			});

			return {
				failureReportId: existing.id,
				candidateId: null,
				category: aggregated.category,
				autoPromoteEligible: false,
				skipped: false,
				skipReason: "group_incremented",
			};
		}
	}

	// ── Step 5: Create failure report ──────────────────────────────────────
	const failureReport = createFailureReport({
		id: crypto.randomUUID(),
		traceId: trace.traceId,
		spanId: targetSpan.spanId,
		category: aggregated.category as Parameters<
			typeof createFailureReport
		>[0]["category"],
		severity:
			aggregated.confidence >= 0.8
				? "high"
				: aggregated.confidence >= 0.5
					? "medium"
					: "low",
		description: `Detected ${aggregated.category} in span "${targetSpan.name}"`,
		confidence: aggregated.confidence,
		detectedBy: "rule-based",
		evidence: targetSpan.output ?? undefined,
	});

	const confidenceInt = Math.round(aggregated.confidence * 100);
	const metadata = (trace.metadata ?? {}) as Record<string, unknown>;

	const [reportRow] = await db
		.insert(failureReports)
		.values({
			organizationId,
			traceId: traceDbId,
			spanId: targetSpan.spanId,
			category: aggregated.category,
			severity: failureReport.severity,
			description: failureReport.description,
			evidence: targetSpan.output,
			confidence: confidenceInt,
			detectorCount: aggregated.totalDetectors,
			detectedBy: "rule-based",
			suggestedFixes: failureReport.suggestedFixes,
			lineage: failureReport.lineage,
			groupHash,
			modelVersion: (metadata.model_version as string) ?? null,
			promptVersion: (metadata.prompt_version as string) ?? null,
			createdAt: new Date(),
		})
		.returning();

	// ── Step 6: Generate candidate eval case ────────────────────────────────
	const traceForMinimization = {
		traceId: trace.traceId,
		spans: traceSpans.map((s) => ({
			spanId: s.spanId,
			name: s.name,
			type: s.type as "llm" | "tool" | "agent" | "retrieval",
			input: s.input ?? undefined,
			output: s.output ?? undefined,
			metadata: (s.metadata ?? {}) as Record<string, unknown>,
		})),
		failureSpanId: targetSpan.spanId,
	};

	const generated = generateFromTrace({
		trace: traceForMinimization,
		failureReport,
	});

	if (!generated.evalCase) {
		return {
			failureReportId: reportRow?.id,
			candidateId: null,
			category: aggregated.category,
			autoPromoteEligible: false,
			skipped: false,
		};
	}

	// ── Step 7: Score quality ────────────────────────────────────────────────
	const qualityResult = evaluateTestQuality(generated.evalCase);

	// ── Step 8: Auto-promote check ──────────────────────────────────────────
	const autoPromote = isAutoPromoteEligible({
		qualityScore: qualityResult.compositeScore,
		confidence: confidenceInt,
		detectorCount: aggregated.totalDetectors,
	});

	// ── Step 9: Persist candidate ───────────────────────────────────────────
	const [candidateRow] = await db
		.insert(candidateEvalCases)
		.values({
			organizationId,
			failureReportId: reportRow?.id,
			traceId: traceDbId,
			title: generated.evalCase.title,
			tags: generated.evalCase.tags ?? [],
			sourceTraceIds: [trace.traceId],
			expectedConstraints:
				generated.evalCase.expectedConstraints?.map((c) => ({
					type: c.type,
					value: c.value,
					required: c.required ?? true,
					description: c.description,
				})) ?? [],
			minimizedInput: generated.minimizedInput
				? {
						userPrompt: generated.minimizedInput.userPrompt,
						systemPrompt: generated.minimizedInput.systemPrompt,
						activeTools: generated.minimizedInput.activeTools,
						conversationContext: generated.minimizedInput.conversationContext,
						failureSpanId: generated.minimizedInput.failureSpanId,
						failureOutput: generated.minimizedInput.failureOutput,
						metadata: generated.minimizedInput.metadata,
					}
				: null,
			evalCaseId: generated.evalCase.id,
			qualityScore: qualityResult.compositeScore,
			qualityVerdict: qualityResult.verdict,
			autoPromoteEligible: autoPromote,
			rationale: generated.rationale,
			createdAt: new Date(),
		})
		.returning();

	// ── Mark trace as analyzed ──────────────────────────────────────────────
	await db
		.update(traces)
		.set({ analysisStatus: "analyzed" })
		.where(eq(traces.id, traceDbId));

	logger.info("Pipeline completed", {
		traceDbId,
		failureReportId: reportRow?.id,
		candidateId: candidateRow?.id,
		category: aggregated.category,
		qualityScore: qualityResult.compositeScore,
		autoPromoteEligible: autoPromote,
	});

	return {
		failureReportId: reportRow?.id,
		candidateId: candidateRow?.id,
		category: aggregated.category,
		autoPromoteEligible: autoPromote,
		skipped: false,
	};
}
