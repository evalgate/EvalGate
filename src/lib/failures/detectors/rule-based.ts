/**
 * Rule-Based Failure Detector — keyword/pattern matching on trace outputs.
 *
 * Replaces the inline keyword matching in DebugAgentService with a structured,
 * extensible detector that emits typed DetectorSignals.
 */

import type { DetectorSignal } from "../confidence";
import { FailureCategory } from "../taxonomy";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RuleBasedDetectorInput {
	output: string;
	input?: string;
	errorMessage?: string | null;
	latencyMs?: number | null;
	expectedLatencyMs?: number | null;
	costUsd?: number | null;
	expectedCostUsd?: number | null;
	tokenCount?: number | null;
}

// ── Rule definitions ──────────────────────────────────────────────────────────

interface CategoryRule {
	category: FailureCategory;
	patterns: RegExp[];
	weight: number;
	baseConfidence: number;
}

const CATEGORY_RULES: CategoryRule[] = [
	{
		category: FailureCategory.HALLUCINATION,
		patterns: [
			/as an ai language model/i,
			/i don't have access to real-time/i,
			/i cannot browse the internet/i,
			/my knowledge cutoff/i,
			/according to my training data/i,
			/\bfictional\b.*\bpresented as fact/i,
		],
		weight: 0.8,
		baseConfidence: 0.65,
	},
	{
		category: FailureCategory.REFUSAL,
		patterns: [
			/i(?:'m| am) sorry,? but i(?:'m| am)? (?:unable|not able) to/i,
			/i cannot (?:help|assist) with/i,
			/(?:this|that) (?:request|query|task) (?:is|seems) (?:inappropriate|harmful|unethical)/i,
			/i must decline/i,
			/i(?:'m| am) not (?:designed|programmed) to/i,
		],
		weight: 0.9,
		baseConfidence: 0.85,
	},
	{
		category: FailureCategory.OFF_TOPIC,
		patterns: [
			/(?:not related|unrelated|off.topic|out of scope)/i,
			/(?:that(?:'s| is) not|this (?:isn't|is not)) what (?:you|the user) asked/i,
		],
		weight: 0.6,
		baseConfidence: 0.55,
	},
	{
		category: FailureCategory.FORMATTING,
		patterns: [
			/```[\s\S]*```/, // code blocks when plain text expected
			/\|\s*---+\s*\|/, // markdown tables
		],
		weight: 0.5,
		baseConfidence: 0.45,
	},
	{
		category: FailureCategory.INCOMPLETE,
		patterns: [
			/\.\.\.$|…$/,
			/\[(?:incomplete|truncated|cut off)\]/i,
			/(?:to be continued|continued below)/i,
		],
		weight: 0.7,
		baseConfidence: 0.6,
	},
	{
		category: FailureCategory.REASONING_ERROR,
		patterns: [
			/(?:therefore|thus|so),? (?:the answer is|it follows that).*(?:wrong|incorrect)/i,
			/(?:contradict|inconsisten)/i,
			/(?:but earlier|however earlier|previously I said)/i,
		],
		weight: 0.6,
		baseConfidence: 0.55,
	},
	{
		category: FailureCategory.TOOL_SELECTION_ERROR,
		patterns: [
			/(?:wrong tool|incorrect tool|used the wrong|selected the wrong)/i,
			/(?:should have used|should have called)/i,
		],
		weight: 0.7,
		baseConfidence: 0.6,
	},
	{
		category: FailureCategory.COMPLIANCE_VIOLATION,
		patterns: [
			/(?:pii|personal(?:ly)? identifiable)/i,
			/(?:hipaa|gdpr|pci.dss|sox|finra)/i,
			/(?:credit card|social security|ssn|date of birth)\s*(?:number|#)?:\s*\d/i,
		],
		weight: 0.95,
		baseConfidence: 0.8,
	},
	{
		category: FailureCategory.RETRIEVAL_FAILURE,
		patterns: [
			/(?:no (?:results|documents|context) (?:found|retrieved))/i,
			/(?:retrieval (?:failed|error|timeout))/i,
			/(?:context (?:not available|unavailable|missing))/i,
		],
		weight: 0.8,
		baseConfidence: 0.7,
	},
];

// ── Detector ──────────────────────────────────────────────────────────────────

export const RULE_BASED_DETECTOR_ID = "rule-based-v1";

/**
 * Run rule-based detection on a trace output.
 * Returns an array of DetectorSignals, one per matched category.
 */
export function detectRuleBased(
	input: RuleBasedDetectorInput,
): DetectorSignal[] {
	const signals: DetectorSignal[] = [];
	const text = input.output ?? "";

	for (const rule of CATEGORY_RULES) {
		for (const pattern of rule.patterns) {
			const match = pattern.exec(text);
			if (match) {
				signals.push({
					detectorId: RULE_BASED_DETECTOR_ID,
					weight: rule.weight,
					category: rule.category,
					rawConfidence: rule.baseConfidence,
					evidence: match[0].slice(0, 200),
				});
				break; // One signal per category per run
			}
		}
	}

	// Latency regression
	if (
		input.latencyMs !== null &&
		input.latencyMs !== undefined &&
		input.expectedLatencyMs !== null &&
		input.expectedLatencyMs !== undefined &&
		input.expectedLatencyMs > 0
	) {
		const latencyRatio = input.latencyMs / input.expectedLatencyMs;
		if (latencyRatio > 2.0) {
			signals.push({
				detectorId: RULE_BASED_DETECTOR_ID,
				weight: 0.9,
				category: FailureCategory.LATENCY_REGRESSION,
				rawConfidence: Math.min(0.95, 0.5 + (latencyRatio - 2) * 0.1),
				evidence: `Latency ${input.latencyMs}ms vs expected ${input.expectedLatencyMs}ms (${latencyRatio.toFixed(1)}x)`,
			});
		}
	}

	// Cost regression
	if (
		input.costUsd !== null &&
		input.costUsd !== undefined &&
		input.expectedCostUsd !== null &&
		input.expectedCostUsd !== undefined &&
		input.expectedCostUsd > 0
	) {
		const costRatio = input.costUsd / input.expectedCostUsd;
		if (costRatio > 2.0) {
			signals.push({
				detectorId: RULE_BASED_DETECTOR_ID,
				weight: 0.85,
				category: FailureCategory.COST_REGRESSION,
				rawConfidence: Math.min(0.95, 0.5 + (costRatio - 2) * 0.1),
				evidence: `Cost $${input.costUsd.toFixed(4)} vs expected $${input.expectedCostUsd.toFixed(4)} (${costRatio.toFixed(1)}x)`,
			});
		}
	}

	// Error message — classify as OTHER if no other category matched
	if (input.errorMessage && signals.length === 0) {
		signals.push({
			detectorId: RULE_BASED_DETECTOR_ID,
			weight: 0.7,
			category: FailureCategory.OTHER,
			rawConfidence: 0.5,
			evidence: input.errorMessage.slice(0, 200),
		});
	}

	return signals;
}
