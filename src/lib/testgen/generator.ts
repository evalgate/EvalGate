/**
 * Test Case Generator — Orchestrate trace → EvalCase draft pipeline.
 *
 * Given a trace (with an optional identified failure), produces a draft EvalCase
 * ready for human review in the quarantine dataset.
 */

import type { FailureReport } from "@/lib/failures/taxonomy";
import {
	createEvalCase,
	type EvalCase,
	type ExpectedConstraint,
} from "@/lib/testcases/spec";
import { minimizeTrace, type TraceForMinimization } from "./trace-minimizer";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratorInput {
	trace: TraceForMinimization;
	/** Optional failure report that triggered this generation */
	failureReport?: FailureReport | null;
	/** Tags to add to the generated case */
	extraTags?: string[];
	/** Redaction profile to attach */
	redactionProfileRef?: string | null;
	/** Rubric reference */
	rubricRef?: string | null;
}

export interface GeneratorResult {
	evalCase: EvalCase;
	/** Human-readable explanation of why this test was generated */
	rationale: string;
	/** Whether this case went to quarantine (always true for auto-generated) */
	quarantined: true;
	/** Minimized input extracted from the trace */
	minimizedInput: ReturnType<typeof minimizeTrace>;
}

// ── Category → constraint mapping ────────────────────────────────────────────

function categoryToConstraints(category: string): ExpectedConstraint[] {
	const constraints: ExpectedConstraint[] = [];

	switch (category) {
		case "hallucination":
			constraints.push({
				type: "no_toxicity",
				value: true,
				required: true,
				description: "Response must not contain fabricated facts",
			});
			break;
		case "refusal":
			constraints.push({
				type: "matches_regex",
				// Covers common refusal patterns across GPT, Claude, Gemini, Llama families.
				// Uses [Ii] character classes instead of PCRE (?i) — valid in all JS regex engines.
				// Evaluation runners should match this against the agent output; a match = FAIL.
				value:
					"([Ii](?:'m| am) (?:unable|not able)|[Ii] (?:cannot|can't|won't|refuse)|[Ii] do not have (?:the ability|access|permission)|[Aa]s an [Aa][Ii]|[Ii]'m sorry,? but [Ii] (?:can't|cannot))",
				required: true,
				description: "Response must not contain common LLM refusal phrases",
			});
			break;
		case "compliance_violation":
			constraints.push({
				type: "no_pii",
				value: true,
				required: true,
				description: "Response must not contain PII",
			});
			break;
		case "formatting":
			constraints.push({
				type: "custom",
				value: { check: "no_unwanted_markdown" },
				required: false,
				description: "Response formatting matches expected format",
			});
			break;
		case "incomplete":
			constraints.push({
				type: "score_gte",
				value: 0.6,
				required: true,
				description: "Response must be sufficiently complete",
			});
			break;
		default:
			constraints.push({
				type: "score_gte",
				value: 0.7,
				required: true,
				description: "Response quality score above threshold",
			});
	}

	return constraints;
}

// ── Title generation ──────────────────────────────────────────────────────────

function generateTitle(
	minimized: ReturnType<typeof minimizeTrace>,
	failureReport: FailureReport | null | undefined,
): string {
	const category = failureReport?.category;
	const prefix = category ? `[${category.replace("_", "-")}] ` : "";

	const prompt = minimized.userPrompt;
	const excerpt = prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt;

	return excerpt.trim()
		? `${prefix}${excerpt}`
		: `${prefix}Auto-generated from trace`;
}

// ── Tags generation ───────────────────────────────────────────────────────────

function generateTags(
	minimized: ReturnType<typeof minimizeTrace>,
	failureReport: FailureReport | null | undefined,
	extraTags: string[],
): string[] {
	const tags = new Set<string>(["auto-generated", ...extraTags]);

	if (failureReport?.category) tags.add(failureReport.category);
	if (failureReport?.severity) tags.add(`severity:${failureReport.severity}`);
	if (minimized.activeTools.length > 0) tags.add("uses-tools");
	if (minimized.systemPrompt) tags.add("has-system-prompt");
	if (minimized.conversationContext.length > 2) tags.add("multi-turn");

	return Array.from(tags);
}

// ── Rationale ─────────────────────────────────────────────────────────────────

function generateRationale(
	failureReport: FailureReport | null | undefined,
	minimized: ReturnType<typeof minimizeTrace>,
): string {
	if (failureReport) {
		return `Auto-generated from failure #${failureReport.id} (${failureReport.category}, confidence ${(failureReport.confidence * 100).toFixed(0)}%). Detected by: ${failureReport.detectedBy}. Evidence: ${failureReport.evidence ?? "none"}.`;
	}
	const contextNote =
		minimized.conversationContext.length > 0
			? ` Includes ${minimized.conversationContext.length} prior turn(s).`
			: "";
	return `Auto-generated from trace ${minimized.failureSpanId ? `(failure span: ${minimized.failureSpanId})` : "(last LLM span)"}.${contextNote}`;
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Generate a draft EvalCase from a trace.
 * Always quarantined — requires human approval before becoming a gate.
 */
export function generateFromTrace(input: GeneratorInput): GeneratorResult {
	const minimized = minimizeTrace(input.trace);

	const title = generateTitle(minimized, input.failureReport);
	const tags = generateTags(
		minimized,
		input.failureReport,
		input.extraTags ?? [],
	);
	const expectedConstraints = input.failureReport
		? categoryToConstraints(input.failureReport.category)
		: [{ type: "score_gte" as const, value: 0.7, required: true }];

	const evalCase = createEvalCase({
		title,
		tags,
		sourceTraceIds: [input.trace.traceId],
		rubricRef: input.rubricRef ?? null,
		redactionProfileRef: input.redactionProfileRef ?? "default",
		expectedConstraints,
		quarantined: true,
	});

	const rationale = generateRationale(input.failureReport, minimized);

	return {
		evalCase,
		rationale,
		quarantined: true,
		minimizedInput: minimized,
	};
}
